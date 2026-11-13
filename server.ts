import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  computeBenchmarks,
  computeKeywordMetrics,
  computeSummary,
  createInitialWorkspaceState,
  evaluateAlertThresholds,
  evaluateBidRules,
  FEEDERS,
  generateReport,
  keywordsToCsv,
  processLiveTick,
  reportToCsv,
  round2,
  round3,
} from './src/lib/arbitrageEngine';
import type {
  AlertThreshold,
  ApiSyncLog,
  BidAuditEntry,
  BidRule,
  FeederId,
  KeywordStatus,
  WorkspaceState,
} from './src/types/arbitrage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '.data');
const STATE_FILE = path.join(DATA_DIR, 'arbpulse-state.json');
const PORT = Number(process.env.PORT ?? 3000);

function loadOrInitState(): WorkspaceState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as WorkspaceState;
      if (parsed && Array.isArray(parsed.keywords) && parsed.keywords.length === 1000) {
        return parsed;
      }
    }
  } catch {
    // Fall back to fresh deterministic seed if state file is corrupted
  }
  const fresh = createInitialWorkspaceState();
  persistState(fresh);
  return fresh;
}

function persistState(state: WorkspaceState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch {
    // Non-fatal in read-only sandboxes
  }
}

async function startServer() {
  let state: WorkspaceState = loadOrInitState();
  let tickCount = state.summary.tickCount || 1;
  let lastReportDay = new Date().toISOString().slice(0, 10);

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  function broadcast(payload: Record<string, unknown>) {
    const msg = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        type: 'connected',
        tickCount,
        timestamp: new Date().toISOString(),
      })
    );
  });

  // ---------------------------------------------------------------------------
  // REST API Endpoints
  // ---------------------------------------------------------------------------

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, keywords: state.keywords.length, tickCount });
  });

  app.get('/api/state', (_req, res) => {
    res.json(state);
  });

  app.patch('/api/keywords/:id', (req, res) => {
    const { id } = req.params;
    const { cpcBid, status } = req.body as {
      cpcBid?: number;
      status?: KeywordStatus;
    };

    const idx = state.keywords.findIndex((k) => k.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Keyword not found' });
    }

    const current = state.keywords[idx];
    const nowIso = new Date().toISOString();
    const nextBid =
      typeof cpcBid === 'number' && Number.isFinite(cpcBid) && cpcBid > 0
        ? round3(Math.max(0.05, Math.min(15, cpcBid)))
        : current.cpcBid;
    const nextStatus = status ?? current.status;

    const metrics = computeKeywordMetrics(
      current.clicks,
      current.feederClicks,
      nextBid,
      current.rpc,
      current.impressions
    );

    const deltaPct =
      current.cpcBid > 0 ? round2(((nextBid - current.cpcBid) / current.cpcBid) * 100) : 0;

    const updated = {
      ...current,
      cpcBid: nextBid,
      status: nextStatus,
      lastBidChangePct: deltaPct !== 0 ? deltaPct : current.lastBidChangePct,
      ...metrics,
      lastUpdatedAt: nowIso,
    };

    state.keywords[idx] = updated;
    state.summary = computeSummary(state.keywords, tickCount, nowIso);
    state.benchmarks = computeBenchmarks(state.keywords, state.summary);

    let newAudit: BidAuditEntry | null = null;
    if (Math.abs(nextBid - current.cpcBid) >= 0.001 || nextStatus !== current.status) {
      newAudit = {
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
      };
      state.bidAuditLog = [newAudit, ...state.bidAuditLog].slice(0, 80);
    }

    persistState(state);
    broadcast({
      type: 'keyword_updated',
      keyword: updated,
      summary: state.summary,
      benchmarks: state.benchmarks,
      auditEntry: newAudit,
    });

    res.json({ keyword: updated, summary: state.summary, auditEntry: newAudit });
  });

  app.patch('/api/auto-bidding', (req, res) => {
    const { enabled } = req.body as { enabled?: boolean };
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled boolean is required' });
    }
    state.autoBiddingEnabled = enabled;
    persistState(state);
    broadcast({ type: 'state_sync', autoBiddingEnabled: state.autoBiddingEnabled });
    res.json({ autoBiddingEnabled: state.autoBiddingEnabled });
  });

  app.post('/api/bid-rules', (req, res) => {
    const body = req.body as Partial<BidRule>;
    if (!body.name || !body.network || !body.metric || !body.operator || body.threshold === undefined) {
      return res.status(400).json({ error: 'Missing required bid rule fields' });
    }

    const newRule: BidRule = {
      id: `rule-${Date.now()}`,
      name: String(body.name).trim(),
      enabled: body.enabled ?? true,
      network: body.network,
      feeder: body.feeder ?? 'all',
      metric: body.metric,
      operator: body.operator,
      threshold: Number(body.threshold),
      minClicks: Math.max(0, Number(body.minClicks ?? 50)),
      actionType: body.actionType ?? 'increase_pct',
      actionValuePct: Math.max(0, Number(body.actionValuePct ?? 10)),
      executionCount: 0,
      lastExecutedAt: null,
    };

    state.bidRules = [newRule, ...state.bidRules];
    persistState(state);
    broadcast({ type: 'rules_updated', bidRules: state.bidRules });
    res.status(201).json(newRule);
  });

  app.patch('/api/bid-rules/:id', (req, res) => {
    const { id } = req.params;
    const { enabled } = req.body as { enabled?: boolean };
    const idx = state.bidRules.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Rule not found' });

    if (typeof enabled === 'boolean') {
      state.bidRules[idx] = { ...state.bidRules[idx], enabled };
    }
    persistState(state);
    broadcast({ type: 'rules_updated', bidRules: state.bidRules });
    res.json(state.bidRules[idx]);
  });

  app.delete('/api/bid-rules/:id', (req, res) => {
    const { id } = req.params;
    state.bidRules = state.bidRules.filter((r) => r.id !== id);
    persistState(state);
    broadcast({ type: 'rules_updated', bidRules: state.bidRules });
    res.json({ ok: true, bidRules: state.bidRules });
  });

  app.post('/api/bid-rules/execute', (_req, res) => {
    const nowIso = new Date().toISOString();
    // Run across a randomized/rotating slice or full 1000 keywords, capping audit flood
    const result = evaluateBidRules(state.keywords, state.bidRules, nowIso);
    state.keywords = result.keywords;
    state.bidRules = result.rules;
    if (result.auditEntries.length > 0) {
      state.bidAuditLog = [...result.auditEntries.slice(0, 25), ...state.bidAuditLog].slice(0, 80);
    }
    state.summary = computeSummary(state.keywords, tickCount, nowIso);
    state.benchmarks = computeBenchmarks(state.keywords, state.summary);
    persistState(state);

    broadcast({
      type: 'state_refresh',
      state,
    });

    res.json({
      appliedCount: result.auditEntries.length,
      bidRules: state.bidRules,
      auditEntries: result.auditEntries.slice(0, 25),
      summary: state.summary,
    });
  });

  app.post('/api/alert-thresholds', (req, res) => {
    const body = req.body as Partial<AlertThreshold>;
    if (!body.name || !body.metric || !body.operator || body.threshold === undefined) {
      return res.status(400).json({ error: 'Missing required alert threshold fields' });
    }

    const scope = (body.scope ?? 'global') as FeederId | 'global';
    const scopeLabel =
      scope === 'global' ? 'All Feeders (Blended)' : FEEDERS[scope]?.name ?? 'Unknown';

    const newThreshold: AlertThreshold = {
      id: `th-${Date.now()}`,
      name: String(body.name).trim(),
      enabled: body.enabled ?? true,
      scope,
      scopeLabel,
      metric: body.metric,
      operator: body.operator,
      threshold: Number(body.threshold),
      severity: body.severity ?? 'warning',
      channel: body.channel ?? 'Dashboard + Webhook',
    };

    state.alertThresholds = [newThreshold, ...state.alertThresholds];
    const nowIso = new Date().toISOString();
    const triggered = evaluateAlertThresholds(
      state.summary,
      [newThreshold],
      state.alerts,
      nowIso
    );
    if (triggered.length > 0) {
      state.alerts = [...triggered, ...state.alerts].slice(0, 50);
    }

    persistState(state);
    broadcast({
      type: 'alerts_updated',
      alertThresholds: state.alertThresholds,
      alerts: state.alerts,
    });
    res.status(201).json({ threshold: newThreshold, triggered });
  });

  app.patch('/api/alert-thresholds/:id', (req, res) => {
    const { id } = req.params;
    const { enabled } = req.body as { enabled?: boolean };
    const idx = state.alertThresholds.findIndex((t) => t.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Threshold not found' });

    if (typeof enabled === 'boolean') {
      state.alertThresholds[idx] = { ...state.alertThresholds[idx], enabled };
    }
    persistState(state);
    broadcast({
      type: 'alerts_updated',
      alertThresholds: state.alertThresholds,
      alerts: state.alerts,
    });
    res.json(state.alertThresholds[idx]);
  });

  app.delete('/api/alert-thresholds/:id', (req, res) => {
    const { id } = req.params;
    state.alertThresholds = state.alertThresholds.filter((t) => t.id !== id);
    persistState(state);
    broadcast({
      type: 'alerts_updated',
      alertThresholds: state.alertThresholds,
      alerts: state.alerts,
    });
    res.json({ ok: true });
  });

  app.post('/api/alerts/:id/acknowledge', (req, res) => {
    const { id } = req.params;
    state.alerts = state.alerts.map((a) =>
      a.id === id ? { ...a, acknowledged: true } : a
    );
    persistState(state);
    broadcast({
      type: 'alerts_updated',
      alertThresholds: state.alertThresholds,
      alerts: state.alerts,
    });
    res.json({ ok: true, alerts: state.alerts });
  });

  app.patch('/api/integrations/:id', (req, res) => {
    const { id } = req.params;
    const { syncIntervalSec, endpoints } = req.body as {
      syncIntervalSec?: number;
      endpoints?: Partial<{
        campaigns: boolean;
        keywords: boolean;
        conversions: boolean;
        postbacks: boolean;
      }>;
    };

    const idx = state.integrations.findIndex((i) => i.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Integration not found' });

    const current = state.integrations[idx];
    state.integrations[idx] = {
      ...current,
      syncIntervalSec:
        typeof syncIntervalSec === 'number' && syncIntervalSec >= 5
          ? Math.round(syncIntervalSec)
          : current.syncIntervalSec,
      endpoints: endpoints ? { ...current.endpoints, ...endpoints } : current.endpoints,
    };

    persistState(state);
    broadcast({ type: 'integrations_updated', integrations: state.integrations, syncLogs: state.syncLogs });
    res.json(state.integrations[idx]);
  });

  app.post('/api/integrations/:id/sync', (req, res) => {
    const { id } = req.params;
    const { endpointScope } = (req.body ?? {}) as { endpointScope?: string };
    const idx = state.integrations.findIndex((i) => i.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Integration not found' });

    const nowIso = new Date().toISOString();
    const target = state.integrations[idx];
    const recordsProcessed = target.feederId ? 200 : 340;
    const durationMs = 95 + Math.floor(Math.random() * 140);

    state.integrations[idx] = {
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

    state.syncLogs = [newLog, ...state.syncLogs].slice(0, 50);
    persistState(state);
    broadcast({
      type: 'integrations_updated',
      integrations: state.integrations,
      syncLogs: state.syncLogs,
    });

    res.json({ integration: state.integrations[idx], log: newLog });
  });

  app.post('/api/reports/generate', (req, res) => {
    const { cadence } = (req.body ?? {}) as { cadence?: 'daily' | 'weekly' };
    const mode = cadence === 'weekly' ? 'weekly' : 'daily';
    const nowIso = new Date().toISOString();

    const report = generateReport(
      mode,
      state.keywords,
      state.summary,
      state.bidAuditLog.length,
      state.alerts.length,
      false,
      nowIso
    );

    state.reports = [report, ...state.reports].slice(0, 30);
    persistState(state);
    broadcast({ type: 'reports_updated', reports: state.reports });
    res.status(201).json(report);
  });

  app.get('/api/reports/:id/csv', (req, res) => {
    const report = state.reports.find((r) => r.id === req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const csv = reportToCsv(report);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="arbpulse-${report.cadence}-report-${report.periodLabel.replace(/\s+/g, '_')}.csv"`
    );
    res.send(csv);
  });

  app.get('/api/keywords/export', (req, res) => {
    const feeder = String(req.query.feeder ?? 'all');
    const network = String(req.query.network ?? 'all');
    const q = String(req.query.q ?? '').trim().toLowerCase();

    const filtered = state.keywords.filter((k) => {
      if (feeder !== 'all' && k.feeder !== feeder) return false;
      if (network !== 'all' && k.network !== network) return false;
      if (q && !k.keyword.toLowerCase().includes(q) && !k.vertical.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    const csv = keywordsToCsv(filtered);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="arbpulse-keywords-export.csv"');
    res.send(csv);
  });

  app.get(['/arbpulse-cloudflare-pages.zip', '/api/download/cloudflare-pages'], (_req, res) => {
    const zipPath = path.join(__dirname, 'arbpulse-cloudflare-pages.zip');
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ error: 'Cloudflare Pages archive not found' });
    }
    res.download(zipPath, 'arbpulse-cloudflare-pages.zip');
  });

  // ---------------------------------------------------------------------------
  // Real-Time Market Tick, Auto-Bidding, Alerting & Scheduled Report Loop
  // ---------------------------------------------------------------------------
  const tickInterval = setInterval(() => {
    tickCount += 1;
    const nowIso = new Date().toISOString();

    const tickResult = processLiveTick(
      state.keywords,
      state.trendSeries,
      tickCount,
      nowIso
    );
    state.keywords = tickResult.keywords;
    state.trendSeries = tickResult.trendSeries;
    state.summary = tickResult.summary;

    const updatedSet = new Set(tickResult.updatedIds);
    let newAuditEntries: BidAuditEntry[] = [];

    // Automated bid evaluation every 6 ticks (~15s) on rotating slice of 60 keywords
    if (state.autoBiddingEnabled && tickCount % 6 === 0) {
      const sliceStart = ((tickCount / 6) * 60) % state.keywords.length;
      const windowSlice = state.keywords.slice(sliceStart, sliceStart + 60);
      const bidRes = evaluateBidRules(windowSlice, state.bidRules, nowIso);
      if (bidRes.auditEntries.length > 0) {
        for (let i = 0; i < bidRes.keywords.length; i++) {
          state.keywords[sliceStart + i] = bidRes.keywords[i];
          updatedSet.add(bidRes.keywords[i].id);
        }
        state.bidRules = bidRes.rules;
        newAuditEntries = bidRes.auditEntries.slice(0, 6);
        state.bidAuditLog = [...newAuditEntries, ...state.bidAuditLog].slice(0, 80);
        state.summary = computeSummary(state.keywords, tickCount, nowIso);
      }
    }

    const newAlerts = evaluateAlertThresholds(
      state.summary,
      state.alertThresholds,
      state.alerts,
      nowIso
    );
    if (newAlerts.length > 0) {
      state.alerts = [...newAlerts, ...state.alerts].slice(0, 50);
    }

    state.benchmarks = computeBenchmarks(state.keywords, state.summary);

    // Automatic Daily / Weekly report rollover if UTC day changed
    const todayStr = nowIso.slice(0, 10);
    if (todayStr !== lastReportDay) {
      lastReportDay = todayStr;
      const autoDaily = generateReport(
        'daily',
        state.keywords,
        state.summary,
        state.bidAuditLog.length,
        state.alerts.length,
        true,
        nowIso
      );
      state.reports = [autoDaily, ...state.reports].slice(0, 30);
      if (new Date(nowIso).getUTCDay() === 1) {
        const autoWeekly = generateReport(
          'weekly',
          state.keywords,
          state.summary,
          state.bidAuditLog.length,
          state.alerts.length,
          true,
          nowIso
        );
        state.reports = [autoWeekly, ...state.reports].slice(0, 30);
      }
    }

    if (tickCount % 5 === 0) {
      persistState(state);
    }

    const updatedKeywords = state.keywords.filter((k) => updatedSet.has(k.id));
    broadcast({
      type: 'tick',
      tickCount,
      summary: state.summary,
      latestPoint: state.trendSeries[state.trendSeries.length - 1],
      updatedKeywords,
      benchmarks: state.benchmarks,
      newAuditEntries,
      bidRules: newAuditEntries.length > 0 ? state.bidRules : undefined,
      newAlerts,
    });
  }, 2500);

  // ---------------------------------------------------------------------------
  // Vite Middleware (Dev) or Static Assets (Prod)
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ArbPulse server running on http://0.0.0.0:${PORT}`);
  });

  process.on('SIGTERM', () => {
    clearInterval(tickInterval);
    persistState(state);
    httpServer.close();
  });
}

startServer().catch((err) => {
  console.error('Failed to start ArbPulse server:', err);
  process.exit(1);
});
