import { useCallback, useEffect, useRef, useState } from 'react';
import {
  computeBenchmarks,
  computeKeywordMetrics,
  computeSummary,
  createInitialWorkspaceState,
  evaluateAlertThresholds,
  evaluateBidRules,
  FEEDERS,
  generateReport as buildArbitrageReport,
  processLiveTick,
  round2,
  round3,
} from '../lib/arbitrageEngine';
import type {
  AlertThreshold,
  ApiIntegrationConfig,
  ApiSyncLog,
  ArbitrageReport,
  BidAuditEntry,
  BidRule,
  FeederId,
  KeywordRecord,
  KeywordStatus,
  WorkspaceState,
} from '../types/arbitrage';

export type WsStatus = 'connecting' | 'live' | 'reconnecting';
type RuntimeMode = 'detecting' | 'server' | 'standalone';

const STORAGE_KEY = 'arbpulse_standalone_state_v1';

function loadStandaloneState(): WorkspaceState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkspaceState;
      if (parsed && Array.isArray(parsed.keywords) && parsed.keywords.length === 1000) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage errors
  }
  const fresh = createInitialWorkspaceState();
  saveStandaloneState(fresh);
  return fresh;
}

function saveStandaloneState(state: WorkspaceState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function useArbitrageWorkspace() {
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const [streamPaused, setStreamPaused] = useState(false);
  const [mode, setMode] = useState<RuntimeMode>('detecting');

  const streamPausedRef = useRef(false);
  streamPausedRef.current = streamPaused;

  const modeRef = useRef<RuntimeMode>('detecting');
  modeRef.current = mode;

  const stateRef = useRef<WorkspaceState | null>(null);
  stateRef.current = state;

  const fetchInitialState = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/state');
      const contentType = res.headers.get('content-type') ?? '';
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as WorkspaceState;
        setMode('server');
        setState(data);
        return;
      }
      // Static hosting (e.g., Cloudflare Pages) fallback to standalone local engine
      setMode('standalone');
      setWsStatus('live');
      setState(loadStandaloneState());
    } catch {
      setMode('standalone');
      setWsStatus('live');
      setState(loadStandaloneState());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInitialState();
  }, [fetchInitialState]);

  // Server WebSocket stream when running with full-stack Express backend
  useEffect(() => {
    if (mode !== 'server') return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let unmounted = false;

    function connect() {
      if (unmounted) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/ws`;
      ws = new WebSocket(url);

      ws.onopen = () => {
        if (!unmounted) setWsStatus('live');
      };

      ws.onmessage = (event) => {
        if (unmounted || streamPausedRef.current) return;
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'tick') {
            setState((prev) => {
              if (!prev) return prev;
              const deltaMap = new Map<string, KeywordRecord>();
              for (const k of msg.updatedKeywords as KeywordRecord[]) {
                deltaMap.set(k.id, k);
              }
              const nextKeywords =
                deltaMap.size > 0
                  ? prev.keywords.map((k) => deltaMap.get(k.id) ?? k)
                  : prev.keywords;

              const nextSeries = msg.latestPoint
                ? [...prev.trendSeries.slice(Math.max(0, prev.trendSeries.length - 29)), msg.latestPoint]
                : prev.trendSeries;

              const nextAudit =
                Array.isArray(msg.newAuditEntries) && msg.newAuditEntries.length > 0
                  ? [...msg.newAuditEntries, ...prev.bidAuditLog].slice(0, 80)
                  : prev.bidAuditLog;

              const nextAlerts =
                Array.isArray(msg.newAlerts) && msg.newAlerts.length > 0
                  ? [...msg.newAlerts, ...prev.alerts].slice(0, 50)
                  : prev.alerts;

              return {
                ...prev,
                summary: msg.summary ?? prev.summary,
                keywords: nextKeywords,
                trendSeries: nextSeries,
                benchmarks: msg.benchmarks ?? prev.benchmarks,
                bidAuditLog: nextAudit,
                bidRules: msg.bidRules ?? prev.bidRules,
                alerts: nextAlerts,
              };
            });
          } else if (msg.type === 'state_refresh' && msg.state) {
            setState(msg.state as WorkspaceState);
          } else if (msg.type === 'keyword_updated') {
            setState((prev) => {
              if (!prev) return prev;
              const updatedKw = msg.keyword as KeywordRecord;
              return {
                ...prev,
                keywords: prev.keywords.map((k) => (k.id === updatedKw.id ? updatedKw : k)),
                summary: msg.summary ?? prev.summary,
                benchmarks: msg.benchmarks ?? prev.benchmarks,
                bidAuditLog: msg.auditEntry
                  ? [msg.auditEntry, ...prev.bidAuditLog].slice(0, 80)
                  : prev.bidAuditLog,
              };
            });
          } else if (msg.type === 'rules_updated') {
            setState((prev) => (prev ? { ...prev, bidRules: msg.bidRules } : prev));
          } else if (msg.type === 'alerts_updated') {
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    alertThresholds: msg.alertThresholds ?? prev.alertThresholds,
                    alerts: msg.alerts ?? prev.alerts,
                  }
                : prev
            );
          } else if (msg.type === 'integrations_updated') {
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    integrations: msg.integrations ?? prev.integrations,
                    syncLogs: msg.syncLogs ?? prev.syncLogs,
                  }
                : prev
            );
          } else if (msg.type === 'reports_updated') {
            setState((prev) => (prev ? { ...prev, reports: msg.reports } : prev));
          } else if (msg.type === 'state_sync' && typeof msg.autoBiddingEnabled === 'boolean') {
            setState((prev) =>
              prev ? { ...prev, autoBiddingEnabled: msg.autoBiddingEnabled } : prev
            );
          }
        } catch {
          // Ignore malformed WS payloads
        }
      };

      ws.onclose = () => {
        if (!unmounted) {
          setWsStatus('reconnecting');
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    }

    connect();
    return () => {
      unmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [mode]);

  // Client-side tick engine when deployed on static hosting (Cloudflare Pages)
  useEffect(() => {
    if (mode !== 'standalone') return;

    const timer = setInterval(() => {
      if (streamPausedRef.current) return;
      setState((prev) => {
        if (!prev) return prev;
        const nextTickCount = prev.summary.tickCount + 1;
        const nowIso = new Date().toISOString();
        const tickRes = processLiveTick(
          prev.keywords,
          prev.trendSeries,
          nextTickCount,
          nowIso
        );

        let nextKeywords = tickRes.keywords;
        let nextBidRules = prev.bidRules;
        let nextAuditLog = prev.bidAuditLog;
        let nextSummary = tickRes.summary;

        if (prev.autoBiddingEnabled && nextTickCount % 6 === 0) {
          const sliceStart = ((nextTickCount / 6) * 60) % nextKeywords.length;
          const windowSlice = nextKeywords.slice(sliceStart, sliceStart + 60);
          const bidRes = evaluateBidRules(windowSlice, prev.bidRules, nowIso);
          if (bidRes.auditEntries.length > 0) {
            nextKeywords = [...nextKeywords];
            for (let i = 0; i < bidRes.keywords.length; i++) {
              nextKeywords[sliceStart + i] = bidRes.keywords[i];
            }
            nextBidRules = bidRes.rules;
            nextAuditLog = [...bidRes.auditEntries.slice(0, 6), ...prev.bidAuditLog].slice(0, 80);
            nextSummary = computeSummary(nextKeywords, nextTickCount, nowIso);
          }
        }

        const newAlerts = evaluateAlertThresholds(
          nextSummary,
          prev.alertThresholds,
          prev.alerts,
          nowIso
        );
        const nextAlerts =
          newAlerts.length > 0
            ? [...newAlerts, ...prev.alerts].slice(0, 50)
            : prev.alerts;
        const nextBenchmarks = computeBenchmarks(nextKeywords, nextSummary);

        const nextState: WorkspaceState = {
          ...prev,
          summary: nextSummary,
          keywords: nextKeywords,
          trendSeries: tickRes.trendSeries,
          bidRules: nextBidRules,
          bidAuditLog: nextAuditLog,
          alerts: nextAlerts,
          benchmarks: nextBenchmarks,
        };
        if (nextTickCount % 4 === 0) {
          saveStandaloneState(nextState);
        }
        return nextState;
      });
    }, 2500);

    return () => clearInterval(timer);
  }, [mode]);

  const updateStandalone = useCallback((updater: (prev: WorkspaceState) => WorkspaceState) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      saveStandaloneState(next);
      return next;
    });
  }, []);

  const updateKeyword = useCallback(
    async (id: string, patch: { cpcBid?: number; status?: KeywordStatus }) => {
      if (modeRef.current === 'standalone') {
        const nowIso = new Date().toISOString();
        updateStandalone((prev) => {
          const idx = prev.keywords.findIndex((k) => k.id === id);
          if (idx === -1) return prev;
          const current = prev.keywords[idx];
          const nextBid =
            typeof patch.cpcBid === 'number' && Number.isFinite(patch.cpcBid) && patch.cpcBid > 0
              ? round3(Math.max(0.05, Math.min(15, patch.cpcBid)))
              : current.cpcBid;
          const nextStatus = patch.status ?? current.status;
          const metrics = computeKeywordMetrics(
            current.clicks,
            current.feederClicks,
            nextBid,
            current.rpc,
            current.impressions
          );
          const deltaPct =
            current.cpcBid > 0 ? round2(((nextBid - current.cpcBid) / current.cpcBid) * 100) : 0;
          const updated: KeywordRecord = {
            ...current,
            cpcBid: nextBid,
            status: nextStatus,
            lastBidChangePct: deltaPct !== 0 ? deltaPct : current.lastBidChangePct,
            ...metrics,
            lastUpdatedAt: nowIso,
          };
          const nextKeywords = prev.keywords.map((k) => (k.id === id ? updated : k));
          const nextSummary = computeSummary(nextKeywords, prev.summary.tickCount, nowIso);
          const nextBenchmarks = computeBenchmarks(nextKeywords, nextSummary);
          const newAudit: BidAuditEntry | null =
            Math.abs(nextBid - current.cpcBid) >= 0.001 || nextStatus !== current.status
              ? {
                  id: `bid-man-${Date.now()}-${current.id}`,
                  timestamp: nowIso,
                  ruleId: 'manual',
                  ruleName: 'Manual Desk Override',
                  keywordId: current.id,
                  keyword: current.keyword,
                  network: current.network,
                  feederName: current.feederName,
                  previousBid: current.cpcBid,
                  newBid: nextBid,
                  deltaPct,
                  reason:
                    nextStatus !== current.status && nextBid === current.cpcBid
                      ? `Status changed to ${nextStatus}`
                      : `Manual CPC override ($${current.cpcBid.toFixed(3)} -> $${nextBid.toFixed(3)})`,
                  automated: false,
                }
              : null;

          return {
            ...prev,
            keywords: nextKeywords,
            summary: nextSummary,
            benchmarks: nextBenchmarks,
            bidAuditLog: newAudit ? [newAudit, ...prev.bidAuditLog].slice(0, 80) : prev.bidAuditLog,
          };
        });
        return;
      }

      const res = await fetch(`/api/keywords/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Failed to update keyword');
      const data = await res.json();
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          keywords: prev.keywords.map((k) => (k.id === id ? data.keyword : k)),
          summary: data.summary ?? prev.summary,
          bidAuditLog: data.auditEntry
            ? [data.auditEntry, ...prev.bidAuditLog].slice(0, 80)
            : prev.bidAuditLog,
        };
      });
    },
    [updateStandalone]
  );

  const toggleAutoBidding = useCallback(
    async (enabled: boolean) => {
      if (modeRef.current === 'standalone') {
        updateStandalone((prev) => ({ ...prev, autoBiddingEnabled: enabled }));
        return;
      }
      const res = await fetch('/api/auto-bidding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('Failed to toggle auto-bidding');
      setState((prev) => (prev ? { ...prev, autoBiddingEnabled: enabled } : prev));
    },
    [updateStandalone]
  );

  const createBidRule = useCallback(
    async (rule: Omit<BidRule, 'id' | 'executionCount' | 'lastExecutedAt'>) => {
      if (modeRef.current === 'standalone') {
        const created: BidRule = {
          ...rule,
          id: `rule-${Date.now()}`,
          executionCount: 0,
          lastExecutedAt: null,
        };
        updateStandalone((prev) => ({
          ...prev,
          bidRules: [created, ...prev.bidRules],
        }));
        return created;
      }
      const res = await fetch('/api/bid-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
      if (!res.ok) throw new Error('Failed to create bid rule');
      const created = (await res.json()) as BidRule;
      setState((prev) =>
        prev
          ? {
              ...prev,
              bidRules: prev.bidRules.some((r) => r.id === created.id)
                ? prev.bidRules
                : [created, ...prev.bidRules],
            }
          : prev
      );
      return created;
    },
    [updateStandalone]
  );

  const toggleBidRule = useCallback(
    async (id: string, enabled: boolean) => {
      if (modeRef.current === 'standalone') {
        updateStandalone((prev) => ({
          ...prev,
          bidRules: prev.bidRules.map((r) => (r.id === id ? { ...r, enabled } : r)),
        }));
        return;
      }
      const res = await fetch(`/api/bid-rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('Failed to update rule');
      const updated = (await res.json()) as BidRule;
      setState((prev) =>
        prev
          ? { ...prev, bidRules: prev.bidRules.map((r) => (r.id === id ? updated : r)) }
          : prev
      );
    },
    [updateStandalone]
  );

  const deleteBidRule = useCallback(
    async (id: string) => {
      if (modeRef.current === 'standalone') {
        updateStandalone((prev) => ({
          ...prev,
          bidRules: prev.bidRules.filter((r) => r.id !== id),
        }));
        return;
      }
      const res = await fetch(`/api/bid-rules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete rule');
      setState((prev) =>
        prev ? { ...prev, bidRules: prev.bidRules.filter((r) => r.id !== id) } : prev
      );
    },
    [updateStandalone]
  );

  const executeBidRules = useCallback(async () => {
    if (modeRef.current === 'standalone') {
      const current = stateRef.current;
      if (!current) return 0;
      const nowIso = new Date().toISOString();
      const result = evaluateBidRules(current.keywords, current.bidRules, nowIso);
      const nextSummary = computeSummary(result.keywords, current.summary.tickCount, nowIso);
      const nextBenchmarks = computeBenchmarks(result.keywords, nextSummary);
      updateStandalone((prev) => ({
        ...prev,
        keywords: result.keywords,
        bidRules: result.rules,
        bidAuditLog:
          result.auditEntries.length > 0
            ? [...result.auditEntries.slice(0, 25), ...prev.bidAuditLog].slice(0, 80)
            : prev.bidAuditLog,
        summary: nextSummary,
        benchmarks: nextBenchmarks,
      }));
      return result.auditEntries.length;
    }

    const res = await fetch('/api/bid-rules/execute', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to execute bid rules');
    const data = (await res.json()) as {
      appliedCount: number;
      bidRules: BidRule[];
      summary: WorkspaceState['summary'];
    };
    await fetchInitialState();
    return data.appliedCount;
  }, [fetchInitialState, updateStandalone]);

  const createAlertThreshold = useCallback(
    async (threshold: Omit<AlertThreshold, 'id' | 'scopeLabel'>) => {
      if (modeRef.current === 'standalone') {
        const nowIso = new Date().toISOString();
        const scope = (threshold.scope ?? 'global') as FeederId | 'global';
        const scopeLabel =
          scope === 'global' ? 'All Feeders (Blended)' : FEEDERS[scope]?.name ?? 'Unknown';
        const newThreshold: AlertThreshold = {
          ...threshold,
          id: `th-${Date.now()}`,
          scope,
          scopeLabel,
        };
        updateStandalone((prev) => {
          const triggered = evaluateAlertThresholds(
            prev.summary,
            [newThreshold],
            prev.alerts,
            nowIso
          );
          return {
            ...prev,
            alertThresholds: [newThreshold, ...prev.alertThresholds],
            alerts:
              triggered.length > 0
                ? [...triggered, ...prev.alerts].slice(0, 50)
                : prev.alerts,
          };
        });
        return;
      }

      const res = await fetch('/api/alert-thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(threshold),
      });
      if (!res.ok) throw new Error('Failed to create alert threshold');
      const data = await res.json();
      setState((prev) => {
        if (!prev) return prev;
        const exists = prev.alertThresholds.some((t) => t.id === data.threshold.id);
        return {
          ...prev,
          alertThresholds: exists
            ? prev.alertThresholds
            : [data.threshold, ...prev.alertThresholds],
          alerts:
            Array.isArray(data.triggered) && data.triggered.length > 0
              ? [...data.triggered, ...prev.alerts].slice(0, 50)
              : prev.alerts,
        };
      });
    },
    [updateStandalone]
  );

  const toggleAlertThreshold = useCallback(
    async (id: string, enabled: boolean) => {
      if (modeRef.current === 'standalone') {
        updateStandalone((prev) => ({
          ...prev,
          alertThresholds: prev.alertThresholds.map((t) =>
            t.id === id ? { ...t, enabled } : t
          ),
        }));
        return;
      }
      const res = await fetch(`/api/alert-thresholds/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('Failed to update threshold');
      const updated = (await res.json()) as AlertThreshold;
      setState((prev) =>
        prev
          ? {
              ...prev,
              alertThresholds: prev.alertThresholds.map((t) => (t.id === id ? updated : t)),
            }
          : prev
      );
    },
    [updateStandalone]
  );

  const deleteAlertThreshold = useCallback(
    async (id: string) => {
      if (modeRef.current === 'standalone') {
        updateStandalone((prev) => ({
          ...prev,
          alertThresholds: prev.alertThresholds.filter((t) => t.id !== id),
        }));
        return;
      }
      const res = await fetch(`/api/alert-thresholds/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete threshold');
      setState((prev) =>
        prev
          ? { ...prev, alertThresholds: prev.alertThresholds.filter((t) => t.id !== id) }
          : prev
      );
    },
    [updateStandalone]
  );

  const acknowledgeAlert = useCallback(
    async (id: string) => {
      if (modeRef.current === 'standalone') {
        updateStandalone((prev) => ({
          ...prev,
          alerts: prev.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
        }));
        return;
      }
      const res = await fetch(`/api/alerts/${id}/acknowledge`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to acknowledge alert');
      setState((prev) =>
        prev
          ? {
              ...prev,
              alerts: prev.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
            }
          : prev
      );
    },
    [updateStandalone]
  );

  const syncIntegration = useCallback(
    async (id: string, endpointScope?: string) => {
      if (modeRef.current === 'standalone') {
        const nowIso = new Date().toISOString();
        updateStandalone((prev) => {
          const target = prev.integrations.find((i) => i.id === id);
          if (!target) return prev;
          const recordsProcessed = target.feederId ? 200 : 340;
          const durationMs = 95 + Math.floor(Math.random() * 140);
          const updatedIntg: ApiIntegrationConfig = {
            ...target,
            status: 'connected',
            lastSyncAt: nowIso,
            recordsSyncedToday: target.recordsSyncedToday + recordsProcessed,
          };
          const newLog: ApiSyncLog = {
            id: `sync-${Date.now()}-${target.id}`,
            timestamp: nowIso,
            provider: target.provider,
            endpoint: endpointScope ? `POST /sync/${endpointScope}` : 'GET /keywords/metrics',
            httpStatus: 200,
            durationMs,
            recordsProcessed,
            message: `Synced ${recordsProcessed} records via ${target.provider} API (${endpointScope || 'full-batch'})`,
          };
          return {
            ...prev,
            integrations: prev.integrations.map((i) => (i.id === id ? updatedIntg : i)),
            syncLogs: [newLog, ...prev.syncLogs].slice(0, 50),
          };
        });
        return;
      }

      const res = await fetch(`/api/integrations/${id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpointScope }),
      });
      if (!res.ok) throw new Error('Failed to sync integration');
      const data = await res.json();
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          integrations: prev.integrations.map((i) => (i.id === id ? data.integration : i)),
          syncLogs: data.log ? [data.log, ...prev.syncLogs].slice(0, 50) : prev.syncLogs,
        };
      });
    },
    [updateStandalone]
  );

  const updateIntegration = useCallback(
    async (
      id: string,
      patch: {
        syncIntervalSec?: number;
        endpoints?: Partial<ApiIntegrationConfig['endpoints']>;
      }
    ) => {
      if (modeRef.current === 'standalone') {
        updateStandalone((prev) => ({
          ...prev,
          integrations: prev.integrations.map((i) =>
            i.id === id
              ? {
                  ...i,
                  syncIntervalSec:
                    typeof patch.syncIntervalSec === 'number' && patch.syncIntervalSec >= 5
                      ? Math.round(patch.syncIntervalSec)
                      : i.syncIntervalSec,
                  endpoints: patch.endpoints
                    ? { ...i.endpoints, ...patch.endpoints }
                    : i.endpoints,
                }
              : i
          ),
        }));
        return;
      }

      const res = await fetch(`/api/integrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Failed to update integration');
      const updated = (await res.json()) as ApiIntegrationConfig;
      setState((prev) =>
        prev
          ? {
              ...prev,
              integrations: prev.integrations.map((i) => (i.id === id ? updated : i)),
            }
          : prev
      );
    },
    [updateStandalone]
  );

  const generateReport = useCallback(
    async (cadence: 'daily' | 'weekly') => {
      if (modeRef.current === 'standalone') {
        const current = stateRef.current;
        if (!current) throw new Error('Workspace not ready');
        const nowIso = new Date().toISOString();
        const report = buildArbitrageReport(
          cadence,
          current.keywords,
          current.summary,
          current.bidAuditLog.length,
          current.alerts.length,
          false,
          nowIso
        );
        updateStandalone((prev) => ({
          ...prev,
          reports: [report, ...prev.reports].slice(0, 30),
        }));
        return report;
      }

      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cadence }),
      });
      if (!res.ok) throw new Error('Failed to generate report');
      const report = (await res.json()) as ArbitrageReport;
      setState((prev) =>
        prev
          ? {
              ...prev,
              reports: prev.reports.some((r) => r.id === report.id)
                ? prev.reports
                : [report, ...prev.reports].slice(0, 30),
            }
          : prev
      );
      return report;
    },
    [updateStandalone]
  );

  return {
    state,
    loading,
    error,
    wsStatus,
    streamPaused,
    setStreamPaused,
    refreshState: fetchInitialState,
    updateKeyword,
    toggleAutoBidding,
    createBidRule,
    toggleBidRule,
    deleteBidRule,
    executeBidRules,
    createAlertThreshold,
    toggleAlertThreshold,
    deleteAlertThreshold,
    acknowledgeAlert,
    syncIntegration,
    updateIntegration,
    generateReport,
  };
}
