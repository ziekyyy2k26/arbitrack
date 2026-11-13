import type {
  AdNetwork,
  AlertEvent,
  AlertThreshold,
  ApiIntegrationConfig,
  ApiSyncLog,
  ArbitrageReport,
  BenchmarkEntry,
  BidAuditEntry,
  BidRule,
  DashboardSummary,
  FeederId,
  FeederMeta,
  KeywordRecord,
  KeywordStatus,
  ReportFeederBreakdown,
  TimeSeriesPoint,
  TrendAnnotation,
  WorkspaceState,
} from '../types/arbitrage';

export const FEEDERS: Record<FeederId, FeederMeta> = {
  media_net: {
    id: 'media_net',
    name: 'Media.net',
    domain: 'contextual.media.net',
    settlementWindow: 'Net-30',
    revSharePct: 82,
  },
  tonic: {
    id: 'tonic',
    name: 'Tonic',
    domain: 'api.tonic.com/v3',
    settlementWindow: 'Net-15',
    revSharePct: 85,
  },
  system1: {
    id: 'system1',
    name: 'System1',
    domain: 'rsoc.system1.com',
    settlementWindow: 'Net-30',
    revSharePct: 80,
  },
  meta: {
    id: 'meta',
    name: 'Meta',
    domain: 'graph.facebook.com/v21',
    settlementWindow: 'Instant',
    revSharePct: 78,
  },
  yahoo: {
    id: 'yahoo',
    name: 'Yahoo',
    domain: 'partner.search.yahoo.com',
    settlementWindow: 'Net-30',
    revSharePct: 84,
  },
};

export const FEEDER_LIST: FeederMeta[] = Object.values(FEEDERS);

export const AD_NETWORKS: AdNetwork[] = [
  'Meta Ads',
  'Google Ads',
  'TikTok Ads',
  'Taboola',
  'Bing Ads',
];

const VERTICAL_TERMS: Array<{
  vertical: string;
  bases: string[];
  modifiers: string[];
  baseCpc: number;
  baseRpc: number;
}> = [
  {
    vertical: 'Auto Insurance',
    bases: ['cheap auto insurance', 'car insurance quotes', 'full coverage auto', 'senior driver insurance', 'sr22 insurance'],
    modifiers: ['near me', 'online quote', 'no deposit', 'low monthly', '2026 rates', 'bundle discount', 'same day', 'instant approval', 'multi vehicle', 'zero down'],
    baseCpc: 0.42,
    baseRpc: 0.64,
  },
  {
    vertical: 'Dental Care',
    bases: ['dental implants cost', 'full mouth implants', 'emergency dentist', 'invisalign aligners', 'porcelain veneers'],
    modifiers: ['payment plan', 'for seniors', 'free consultation', 'affordable clinic', 'same day', 'financing options', 'near me', 'no insurance', 'top rated', '2026 pricing'],
    baseCpc: 0.55,
    baseRpc: 0.86,
  },
  {
    vertical: 'Home Solar',
    bases: ['residential solar panels', 'solar battery storage', 'solar roof installation', 'home solar rebate', 'off grid solar kit'],
    modifiers: ['tax credit', 'zero down', 'cost calculator', 'free estimate', '2026 incentives', 'monthly lease', 'best rated', 'kw pricing', 'local installers', 'grid tie'],
    baseCpc: 0.48,
    baseRpc: 0.72,
  },
  {
    vertical: 'Mortgage & Refi',
    bases: ['fha home loan', 'va mortgage refinance', 'heloc credit line', 'reverse mortgage', 'fixed rate refi'],
    modifiers: ['today rates', 'bad credit', 'no closing cost', 'cash out', 'preapproval', 'calculator', 'lenders list', 'low apr', 'fast closing', 'first time buyer'],
    baseCpc: 0.51,
    baseRpc: 0.75,
  },
  {
    vertical: 'Cloud & SaaS',
    bases: ['enterprise crm software', 'erp cloud platform', 'payroll automation', 'endpoint security', 'hris management'],
    modifiers: ['pricing tiers', 'free demo', 'small business', 'b2b comparison', 'annual plan', 'api integration', 'soc2 compliant', 'migration guide', 'best rated', 'roi calculator'],
    baseCpc: 0.62,
    baseRpc: 0.94,
  },
  {
    vertical: 'Medical & Wellness',
    bases: ['hearing aids seniors', 'glp1 weight program', 'sleep apnea cpap', 'laser eye surgery', 'knee brace support'],
    modifiers: ['medicare covered', 'online prescription', 'free trial', 'price guide', 'fda cleared', 'home delivery', 'specialist review', 'discount card', 'top clinics', 'comparison'],
    baseCpc: 0.36,
    baseRpc: 0.54,
  },
  {
    vertical: 'Legal Services',
    bases: ['personal injury lawyer', 'workers comp attorney', 'tax debt relief', 'llc formation service', 'estate planning trust'],
    modifiers: ['free case review', 'no win no fee', 'irs settlement', 'online filing', 'local counsel', '2026 checklist', 'fast consultation', 'top rated', 'cost breakdown', 'direct apply'],
    baseCpc: 0.78,
    baseRpc: 1.18,
  },
  {
    vertical: 'Home Services',
    bases: ['walk in tub seniors', 'metal roof replacement', 'hvac heat pump', 'home warranty plan', 'foundation repair'],
    modifiers: ['rebate program', 'free quote', 'installation cost', 'monthly financing', 'certified pros', 'warranty coverage', 'emergency service', '2026 guide', 'energy star', 'near me'],
    baseCpc: 0.39,
    baseRpc: 0.58,
  },
  {
    vertical: 'EV & Mobility',
    bases: ['electric suv lease', 'hybrid sedan deals', 'home ev charger', 'extended auto warranty', 'fleet gps tracker'],
    modifiers: ['zero down lease', 'federal rebate', '2026 models', 'monthly payment', 'dealer clearance', 'level 2 install', 'instant quote', 'trade in bonus', 'best mileage', 'review'],
    baseCpc: 0.34,
    baseRpc: 0.51,
  },
  {
    vertical: 'Education & Career',
    bases: ['online mba degree', 'nursing rn bridge', 'cybersecurity bootcamp', 'hvac trade school', 'project cert prep'],
    modifiers: ['accredited program', 'tuition grant', 'flexible schedule', 'fast track', '2026 enrollment', 'scholarships', 'job placement', 'self paced', 'financial aid', 'syllabus'],
    baseCpc: 0.31,
    baseRpc: 0.47,
  },
];

const GEOS: Array<'US' | 'CA' | 'UK' | 'AU' | 'DE'> = ['US', 'US', 'US', 'CA', 'UK', 'AU', 'DE'];

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function computeKeywordMetrics(
  clicks: number,
  feederClicks: number,
  cpcBid: number,
  rpc: number,
  impressions: number
): Pick<KeywordRecord, 'spend' | 'revenue' | 'netProfit' | 'roasPct' | 'marginPct' | 'ctrPct'> {
  const spend = round2(clicks * cpcBid);
  const revenue = round2(feederClicks * rpc);
  const netProfit = round2(revenue - spend);
  const roasPct = spend > 0 ? round2((revenue / spend) * 100) : 0;
  const marginPct = revenue > 0 ? round2((netProfit / revenue) * 100) : spend > 0 ? -100 : 0;
  const ctrPct = impressions > 0 ? round2((clicks / impressions) * 100) : 0;
  return { spend, revenue, netProfit, roasPct, marginPct, ctrPct };
}

export function seedKeywords(count = 1000, nowIso = new Date().toISOString()): KeywordRecord[] {
  const rand = seededRandom(20261113);
  const feederKeys: FeederId[] = ['media_net', 'tonic', 'system1', 'meta', 'yahoo'];
  const keywords: KeywordRecord[] = [];
  const usedTerms = new Set<string>();

  for (let i = 0; i < count; i++) {
    const vIdx = i % VERTICAL_TERMS.length;
    const vert = VERTICAL_TERMS[vIdx];
    const base = vert.bases[Math.floor(i / VERTICAL_TERMS.length) % vert.bases.length];
    const mod = vert.modifiers[Math.floor(i / (VERTICAL_TERMS.length * vert.bases.length)) % vert.modifiers.length];
    const geo = GEOS[i % GEOS.length];

    let term = `${base} ${mod}`;
    if (usedTerms.has(term)) {
      const tierSuffix = Math.floor(i / 500) === 0 ? geo.toLowerCase() : `tier ${Math.floor(i / 100) + 1}`;
      term = `${base} ${mod} ${tierSuffix}`;
    }
    while (usedTerms.has(term)) {
      term = `${base} ${mod} #${i + 1}`;
    }
    usedTerms.add(term);

    const feederId = feederKeys[i % feederKeys.length];
    const feederMeta = FEEDERS[feederId];
    const network = AD_NETWORKS[(i + Math.floor(i / 5)) % AD_NETWORKS.length];

    const cpcVariance = 0.78 + rand() * 0.48;
    const cpcBid = round3(vert.baseCpc * cpcVariance);
    // Realistic search arb conversion: some high-ROAS winners, steady mid performers, ~14% soft/losing tail
    const perfFactor = rand();
    const rpcMultiplier =
      perfFactor < 0.14
        ? 0.58 + rand() * 0.34
        : perfFactor < 0.72
          ? 1.08 + rand() * 0.38
          : 1.48 + rand() * 0.65;

    const feederClickRate = 0.72 + rand() * 0.24;
    const rpc = round3(vert.baseRpc * cpcVariance * rpcMultiplier);
    const clicks = Math.floor(28 + rand() * 460);
    const feederClicks = Math.max(1, Math.round(clicks * feederClickRate));
    const impressions = Math.round(clicks / (0.018 + rand() * 0.042));

    const metrics = computeKeywordMetrics(clicks, feederClicks, cpcBid, rpc, impressions);

    let status: KeywordStatus = 'active';
    if (i % 27 === 0) {
      status = 'paused';
    } else if (metrics.roasPct >= 145) {
      status = 'scaling';
    } else if (metrics.roasPct < 95) {
      status = 'throttled';
    }

    keywords.push({
      id: `kw-${String(i + 1).padStart(4, '0')}`,
      index: i + 1,
      keyword: term,
      vertical: vert.vertical,
      geo,
      feeder: feederId,
      feederName: feederMeta.name,
      network,
      campaignName: `${geo}_${vert.vertical.replace(/[^A-Za-z]/g, '').slice(0, 6)}_${feederMeta.name.replace('.', '')}`,
      status,
      cpcBid,
      maxBidCap: round3(cpcBid * 1.65),
      minBidFloor: round3(Math.max(0.08, cpcBid * 0.45)),
      impressions,
      clicks,
      feederClicks,
      rpc,
      ...metrics,
      lastBidChangePct: 0,
      lastUpdatedAt: nowIso,
    });
  }

  return keywords;
}

export function computeSummary(
  keywords: KeywordRecord[],
  tickCount: number,
  lastTickAt: string
): DashboardSummary {
  const feederBuckets: Record<FeederId, ReportFeederBreakdown> = {
    media_net: { feederId: 'media_net', feederName: FEEDERS.media_net.name, activeKeywords: 0, spend: 0, revenue: 0, netProfit: 0, roasPct: 0, marginPct: 0, clicks: 0 },
    tonic: { feederId: 'tonic', feederName: FEEDERS.tonic.name, activeKeywords: 0, spend: 0, revenue: 0, netProfit: 0, roasPct: 0, marginPct: 0, clicks: 0 },
    system1: { feederId: 'system1', feederName: FEEDERS.system1.name, activeKeywords: 0, spend: 0, revenue: 0, netProfit: 0, roasPct: 0, marginPct: 0, clicks: 0 },
    meta: { feederId: 'meta', feederName: FEEDERS.meta.name, activeKeywords: 0, spend: 0, revenue: 0, netProfit: 0, roasPct: 0, marginPct: 0, clicks: 0 },
    yahoo: { feederId: 'yahoo', feederName: FEEDERS.yahoo.name, activeKeywords: 0, spend: 0, revenue: 0, netProfit: 0, roasPct: 0, marginPct: 0, clicks: 0 },
  };

  let activeKeywords = 0;
  let totalSpend = 0;
  let totalRevenue = 0;
  let totalClicks = 0;
  let totalFeederClicks = 0;

  for (const kw of keywords) {
    if (kw.status !== 'paused') activeKeywords++;
    totalSpend += kw.spend;
    totalRevenue += kw.revenue;
    totalClicks += kw.clicks;
    totalFeederClicks += kw.feederClicks;

    const bucket = feederBuckets[kw.feeder];
    if (kw.status !== 'paused') bucket.activeKeywords++;
    bucket.spend += kw.spend;
    bucket.revenue += kw.revenue;
    bucket.clicks += kw.clicks;
  }

  totalSpend = round2(totalSpend);
  totalRevenue = round2(totalRevenue);
  const netProfit = round2(totalRevenue - totalSpend);
  const blendedRoasPct = totalSpend > 0 ? round2((totalRevenue / totalSpend) * 100) : 0;
  const blendedMarginPct = totalRevenue > 0 ? round2((netProfit / totalRevenue) * 100) : 0;
  const avgCpc = totalClicks > 0 ? round3(totalSpend / totalClicks) : 0;
  const avgRpc = totalFeederClicks > 0 ? round3(totalRevenue / totalFeederClicks) : 0;

  const feederStats = Object.values(feederBuckets).map((b) => {
    const spend = round2(b.spend);
    const revenue = round2(b.revenue);
    const profit = round2(revenue - spend);
    return {
      ...b,
      spend,
      revenue,
      netProfit: profit,
      roasPct: spend > 0 ? round2((revenue / spend) * 100) : 0,
      marginPct: revenue > 0 ? round2((profit / revenue) * 100) : 0,
    };
  });

  return {
    totalKeywords: keywords.length,
    activeKeywords,
    totalSpend,
    totalRevenue,
    netProfit,
    blendedRoasPct,
    blendedMarginPct,
    totalClicks,
    avgCpc,
    avgRpc,
    tickCount,
    lastTickAt,
    feederStats,
  };
}

export function seedTrendSeries(summary: DashboardSummary, nowMs = Date.now()): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = [];
  const buckets = 24;
  // Build a smooth intraday cumulative-rate / hourly distribution curve ending at current snapshot scale
  let runningSpend = summary.totalSpend * 0.42;
  let runningRevenue = summary.totalRevenue * 0.42;
  const stepSpend = (summary.totalSpend - runningSpend) / buckets;
  const stepRevenue = (summary.totalRevenue - runningRevenue) / buckets;

  for (let i = buckets; i >= 0; i--) {
    const t = new Date(nowMs - i * 15 * 60 * 1000);
    const wave = Math.sin((buckets - i) * 0.45) * 0.04;
    const spend = round2(Math.max(100, runningSpend * (1 + wave * 0.5)));
    const revenue = round2(Math.max(100, runningRevenue * (1 + wave)));
    const netProfit = round2(revenue - spend);
    const roasPct = spend > 0 ? round2((revenue / spend) * 100) : 0;
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');

    points.push({
      timestamp: t.toISOString(),
      label: `${hh}:${mm}`,
      spend,
      revenue,
      netProfit,
      roasPct,
      clicks: Math.round((summary.totalClicks / (buckets + 1)) * (buckets - i + 1)),
    });

    runningSpend += stepSpend;
    runningRevenue += stepRevenue;
  }

  // Ensure final point matches live summary cleanly
  const last = points[points.length - 1];
  last.spend = summary.totalSpend;
  last.revenue = summary.totalRevenue;
  last.netProfit = summary.netProfit;
  last.roasPct = summary.blendedRoasPct;
  last.clicks = summary.totalClicks;

  return points;
}

export function mapEventsToTrendSeries(
  series: TimeSeriesPoint[],
  bidAuditLog: BidAuditEntry[],
  alerts: AlertEvent[],
  syncLogs: ApiSyncLog[] = []
): Record<number, TrendAnnotation[]> {
  const mapped: Record<number, TrendAnnotation[]> = {};
  if (series.length === 0) return mapped;

  const pointTimes = series.map((p) => new Date(p.timestamp).getTime());
  const firstTime = pointTimes[0];
  const lastTime = pointTimes[pointTimes.length - 1];
  const avgStep =
    pointTimes.length > 1
      ? (lastTime - firstTime) / (pointTimes.length - 1)
      : 60_000;
  const minWindow = firstTime - Math.max(avgStep * 0.6, 60_000);
  const maxWindow = lastTime + Math.max(avgStep * 0.6, 120_000);

  const findNearestIndex = (tsMs: number): number | null => {
    if (!Number.isFinite(tsMs) || tsMs < minWindow || tsMs > maxWindow) return null;
    let bestIdx = 0;
    let bestDiff = Math.abs(tsMs - pointTimes[0]);
    for (let i = 1; i < pointTimes.length; i++) {
      const diff = Math.abs(tsMs - pointTimes[i]);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    return bestIdx;
  };

  const pushAnnotation = (ann: TrendAnnotation) => {
    if (!mapped[ann.pointIndex]) mapped[ann.pointIndex] = [];
    mapped[ann.pointIndex].push(ann);
  };

  for (const alert of alerts) {
    const idx = findNearestIndex(new Date(alert.timestamp).getTime());
    if (idx === null) continue;
    pushAnnotation({
      id: alert.id,
      pointIndex: idx,
      timestamp: alert.timestamp,
      kind: 'alert',
      title: alert.title,
      detail: alert.message,
      meta: `${alert.severity === 'critical' ? 'Critical' : alert.severity === 'warning' ? 'Warning' : 'Notice'} · ${alert.scopeLabel}`,
    });
  }

  for (const bid of bidAuditLog) {
    const idx = findNearestIndex(new Date(bid.timestamp).getTime());
    if (idx === null) continue;
    const sign = bid.deltaPct > 0 ? '+' : '';
    pushAnnotation({
      id: bid.id,
      pointIndex: idx,
      timestamp: bid.timestamp,
      kind: bid.deltaPct < 0 ? 'bid_decrease' : 'bid_increase',
      title: bid.ruleName,
      detail: `${bid.keyword}: $${bid.previousBid.toFixed(3)} → $${bid.newBid.toFixed(3)} (${sign}${bid.deltaPct.toFixed(1)}%)`,
      meta: `${bid.network} · ${bid.feederName}`,
    });
  }

  for (const log of syncLogs) {
    const idx = findNearestIndex(new Date(log.timestamp).getTime());
    if (idx === null) continue;
    pushAnnotation({
      id: log.id,
      pointIndex: idx,
      timestamp: log.timestamp,
      kind: 'campaign_event',
      title: `${log.provider} Sync`,
      detail: log.message,
      meta: `${log.endpoint} · ${log.durationMs}ms`,
    });
  }

  return mapped;
}

export function processLiveTick(
  keywords: KeywordRecord[],
  trendSeries: TimeSeriesPoint[],
  tickCount: number,
  nowIso = new Date().toISOString()
): {
  keywords: KeywordRecord[];
  updatedIds: string[];
  trendSeries: TimeSeriesPoint[];
  summary: DashboardSummary;
} {
  const updatedIds: string[] = [];
  // Deterministic pseudo-random wave per tick across ~110 active keywords so dashboard visibly pulses smoothly
  const nextKeywords = keywords.map((kw, idx) => {
    if (kw.status === 'paused') return kw;
    if ((idx + tickCount * 7) % 9 !== 0) return kw;

    const hash = Math.abs(Math.sin((idx + 1) * 12.9898 + tickCount * 78.233));
    const newClicks = 1 + Math.floor(hash * 4);
    const conversionRatio = 0.74 + (hash * 0.22);
    const newFeederClicks = Math.max(1, Math.round(newClicks * conversionRatio));
    const newImpressions = newClicks * (18 + Math.floor(hash * 22));
    const rpcJitter = 0.985 + (hash % 0.035);
    const nextRpc = round3(Math.max(0.12, kw.rpc * rpcJitter));

    const totalClicks = kw.clicks + newClicks;
    const totalFeederClicks = kw.feederClicks + newFeederClicks;
    const totalImpressions = kw.impressions + newImpressions;
    const metrics = computeKeywordMetrics(
      totalClicks,
      totalFeederClicks,
      kw.cpcBid,
      nextRpc,
      totalImpressions
    );

    updatedIds.push(kw.id);
    return {
      ...kw,
      impressions: totalImpressions,
      clicks: totalClicks,
      feederClicks: totalFeederClicks,
      rpc: nextRpc,
      ...metrics,
      lastUpdatedAt: nowIso,
    };
  });

  const summary = computeSummary(nextKeywords, tickCount, nowIso);
  const d = new Date(nowIso);
  const label = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

  const nextSeries = [
    ...trendSeries.slice(Math.max(0, trendSeries.length - 29)),
    {
      timestamp: nowIso,
      label,
      spend: summary.totalSpend,
      revenue: summary.totalRevenue,
      netProfit: summary.netProfit,
      roasPct: summary.blendedRoasPct,
      clicks: summary.totalClicks,
    },
  ];

  return {
    keywords: nextKeywords,
    updatedIds,
    trendSeries: nextSeries,
    summary,
  };
}

export function evaluateBidRules(
  keywords: KeywordRecord[],
  rules: BidRule[],
  nowIso = new Date().toISOString()
): {
  keywords: KeywordRecord[];
  rules: BidRule[];
  auditEntries: BidAuditEntry[];
} {
  const activeRules = rules.filter((r) => r.enabled);
  if (activeRules.length === 0) {
    return { keywords, rules, auditEntries: [] };
  }

  const ruleHitCounts = new Map<string, number>();
  const auditEntries: BidAuditEntry[] = [];

  const nextKeywords = keywords.map((kw) => {
    if (kw.status === 'paused') return kw;

    for (const rule of activeRules) {
      if (rule.network !== 'All Networks' && kw.network !== rule.network) continue;
      if (rule.feeder !== 'all' && kw.feeder !== rule.feeder) continue;
      if (kw.clicks < rule.minClicks) continue;

      const observed = kw[rule.metric];
      const triggered =
        rule.operator === 'gt' ? observed > rule.threshold : observed < rule.threshold;
      if (!triggered) continue;

      if (rule.actionType === 'pause') {
        ruleHitCounts.set(rule.id, (ruleHitCounts.get(rule.id) ?? 0) + 1);
        auditEntries.push({
          id: `bid-${Date.now()}-${kw.id}-${rule.id}`,
          timestamp: nowIso,
          ruleId: rule.id,
          ruleName: rule.name,
          keywordId: kw.id,
          keyword: kw.keyword,
          network: kw.network,
          feederName: kw.feederName,
          previousBid: kw.cpcBid,
          newBid: kw.cpcBid,
          deltaPct: 0,
          reason: `${rule.metric} ${observed.toFixed(1)} ${rule.operator === 'gt' ? '>' : '<'} ${rule.threshold} (Paused)`,
          automated: true,
        });
        return {
          ...kw,
          status: 'paused' as KeywordStatus,
          lastUpdatedAt: nowIso,
        };
      }

      const multiplier =
        rule.actionType === 'increase_pct'
          ? 1 + rule.actionValuePct / 100
          : 1 - rule.actionValuePct / 100;
      const rawNewBid = round3(kw.cpcBid * multiplier);
      const clampedBid = round3(
        Math.min(kw.maxBidCap, Math.max(kw.minBidFloor, rawNewBid))
      );

      if (Math.abs(clampedBid - kw.cpcBid) < 0.001) continue;

      const actualDeltaPct = round2(((clampedBid - kw.cpcBid) / kw.cpcBid) * 100);
      ruleHitCounts.set(rule.id, (ruleHitCounts.get(rule.id) ?? 0) + 1);

      auditEntries.push({
        id: `bid-${Date.now()}-${kw.id}-${rule.id}`,
        timestamp: nowIso,
        ruleId: rule.id,
        ruleName: rule.name,
        keywordId: kw.id,
        keyword: kw.keyword,
        network: kw.network,
        feederName: kw.feederName,
        previousBid: kw.cpcBid,
        newBid: clampedBid,
        deltaPct: actualDeltaPct,
        reason: `${rule.metric} ${observed.toFixed(1)} ${rule.operator === 'gt' ? '>' : '<'} ${rule.threshold}`,
        automated: true,
      });

      const metrics = computeKeywordMetrics(
        kw.clicks,
        kw.feederClicks,
        clampedBid,
        kw.rpc,
        kw.impressions
      );

      return {
        ...kw,
        cpcBid: clampedBid,
        status: actualDeltaPct > 0 ? ('scaling' as KeywordStatus) : ('throttled' as KeywordStatus),
        lastBidChangePct: actualDeltaPct,
        ...metrics,
        lastUpdatedAt: nowIso,
      };
    }

    return kw;
  });

  const nextRules = rules.map((r) => {
    const hits = ruleHitCounts.get(r.id) ?? 0;
    if (hits === 0) return r;
    return {
      ...r,
      executionCount: r.executionCount + hits,
      lastExecutedAt: nowIso,
    };
  });

  return {
    keywords: nextKeywords,
    rules: nextRules,
    auditEntries,
  };
}

export function evaluateAlertThresholds(
  summary: DashboardSummary,
  thresholds: AlertThreshold[],
  existingAlerts: AlertEvent[],
  nowIso = new Date().toISOString()
): AlertEvent[] {
  const newAlerts: AlertEvent[] = [];

  for (const rule of thresholds) {
    if (!rule.enabled) continue;

    let observed = 0;
    if (rule.scope === 'global') {
      if (rule.metric === 'marginPct') observed = summary.blendedMarginPct;
      else if (rule.metric === 'roasPct') observed = summary.blendedRoasPct;
      else if (rule.metric === 'hourlySpend') observed = round2(summary.totalSpend / 12);
      else observed = 4.2;
    } else {
      const feeder = summary.feederStats.find((f) => f.feederId === rule.scope);
      if (!feeder) continue;
      if (rule.metric === 'marginPct') observed = feeder.marginPct;
      else if (rule.metric === 'roasPct') observed = feeder.roasPct;
      else if (rule.metric === 'hourlySpend') observed = round2(feeder.spend / 12);
      else observed = feeder.marginPct < 15 ? 11.4 : 2.8;
    }

    const breached =
      rule.operator === 'lt' ? observed < rule.threshold : observed > rule.threshold;
    if (!breached) continue;

    // Avoid duplicating an unacknowledged alert for the same threshold rule
    const alreadyOpen = existingAlerts.some(
      (a) => a.thresholdId === rule.id && !a.acknowledged
    );
    if (alreadyOpen) continue;

    newAlerts.push({
      id: `alrt-${Date.now()}-${rule.id}`,
      timestamp: nowIso,
      thresholdId: rule.id,
      title: rule.name,
      message: `${rule.scopeLabel} ${rule.metric} hit ${observed.toFixed(1)} (threshold ${rule.operator === 'lt' ? '<' : '>'} ${rule.threshold})`,
      severity: rule.severity,
      scopeLabel: rule.scopeLabel,
      observedValue: round2(observed),
      thresholdValue: rule.threshold,
      acknowledged: false,
    });
  }

  return newAlerts;
}

export function computeBenchmarks(
  keywords: KeywordRecord[],
  summary: DashboardSummary
): BenchmarkEntry[] {
  const entries: BenchmarkEntry[] = [];

  // Feeder benchmarks
  const feederBaselines: Record<FeederId, { r7: number; r30: number; m7: number; m30: number }> = {
    media_net: { r7: 129.4, r30: 124.8, m7: 22.7, m30: 19.8 },
    tonic: { r7: 136.2, r30: 131.5, m7: 26.5, m30: 23.9 },
    system1: { r7: 124.5, r30: 121.0, m7: 19.6, m30: 17.3 },
    meta: { r7: 118.8, r30: 116.2, m7: 15.8, m30: 13.9 },
    yahoo: { r7: 131.9, r30: 127.6, m7: 24.1, m30: 21.6 },
  };

  for (const f of summary.feederStats) {
    const base = feederBaselines[f.feederId];
    entries.push({
      id: `bm-${f.feederId}`,
      label: f.feederName,
      category: 'feeder',
      todaySpend: f.spend,
      todayRevenue: f.revenue,
      todayRoasPct: f.roasPct,
      todayMarginPct: f.marginPct,
      avg7dRoasPct: base.r7,
      avg30dRoasPct: base.r30,
      avg7dMarginPct: base.m7,
      avg30dMarginPct: base.m30,
      deltaVs7dPct: round2(f.roasPct - base.r7),
      deltaVs30dPct: round2(f.roasPct - base.r30),
    });
  }

  // Ad Network benchmarks
  const netBaselines: Record<AdNetwork, { r7: number; r30: number; m7: number; m30: number }> = {
    'Meta Ads': { r7: 132.1, r30: 128.0, m7: 24.3, m30: 21.8 },
    'Google Ads': { r7: 128.4, r30: 125.9, m7: 22.1, m30: 20.5 },
    'TikTok Ads': { r7: 126.7, r30: 119.4, m7: 21.0, m30: 16.2 },
    Taboola: { r7: 121.3, r30: 118.7, m7: 17.5, m30: 15.8 },
    'Bing Ads': { r7: 134.8, r30: 130.2, m7: 25.8, m30: 23.1 },
  };

  for (const net of AD_NETWORKS) {
    const rows = keywords.filter((k) => k.network === net);
    const spend = round2(rows.reduce((s, r) => s + r.spend, 0));
    const revenue = round2(rows.reduce((s, r) => s + r.revenue, 0));
    const profit = round2(revenue - spend);
    const roas = spend > 0 ? round2((revenue / spend) * 100) : 0;
    const margin = revenue > 0 ? round2((profit / revenue) * 100) : 0;
    const base = netBaselines[net];

    entries.push({
      id: `bm-${net.toLowerCase().replace(/\s+/g, '_')}`,
      label: net,
      category: 'network',
      todaySpend: spend,
      todayRevenue: revenue,
      todayRoasPct: roas,
      todayMarginPct: margin,
      avg7dRoasPct: base.r7,
      avg30dRoasPct: base.r30,
      avg7dMarginPct: base.m7,
      avg30dMarginPct: base.m30,
      deltaVs7dPct: round2(roas - base.r7),
      deltaVs30dPct: round2(roas - base.r30),
    });
  }

  return entries;
}

export function generateReport(
  cadence: 'daily' | 'weekly',
  keywords: KeywordRecord[],
  summary: DashboardSummary,
  bidAuditCount: number,
  alertCount: number,
  autoScheduled = false,
  nowIso = new Date().toISOString()
): ArbitrageReport {
  const scale = cadence === 'weekly' ? 6.8 : 1;
  const dateObj = new Date(nowIso);
  const dateStr = dateObj.toISOString().slice(0, 10);
  const weekStart = new Date(dateObj.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const feederBreakdown: ReportFeederBreakdown[] = summary.feederStats.map((f) => ({
    ...f,
    spend: round2(f.spend * scale),
    revenue: round2(f.revenue * scale),
    netProfit: round2(f.netProfit * scale),
    clicks: Math.round(f.clicks * scale),
  }));

  const totalSpend = round2(summary.totalSpend * scale);
  const totalRevenue = round2(summary.totalRevenue * scale);
  const netProfit = round2(totalRevenue - totalSpend);

  const topKeywords = [...keywords]
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, 8)
    .map((kw) => ({
      keyword: kw.keyword,
      feederName: kw.feederName,
      network: kw.network,
      spend: round2(kw.spend * scale),
      revenue: round2(kw.revenue * scale),
      netProfit: round2(kw.netProfit * scale),
      roasPct: kw.roasPct,
    }));

  return {
    id: `rpt-${cadence}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    cadence,
    title:
      cadence === 'daily'
        ? `Daily Search Arbitrage Settlement Report (${dateStr})`
        : `Weekly Search Arbitrage Executive Digest (${weekStart} to ${dateStr})`,
    periodLabel: cadence === 'daily' ? dateStr : `${weekStart} — ${dateStr}`,
    generatedAt: nowIso,
    autoScheduled,
    totalSpend,
    totalRevenue,
    netProfit,
    blendedRoasPct: summary.blendedRoasPct,
    blendedMarginPct: summary.blendedMarginPct,
    totalClicks: Math.round(summary.totalClicks * scale),
    bidAdjustmentsApplied: Math.round(bidAuditCount * (cadence === 'weekly' ? 5 : 1)),
    alertsTriggered: Math.round(alertCount * (cadence === 'weekly' ? 4 : 1)),
    feederBreakdown,
    topKeywords,
  };
}

export function keywordsToCsv(keywords: KeywordRecord[]): string {
  const header = [
    'Index',
    'Keyword',
    'Vertical',
    'Geo',
    'Feeder',
    'Ad Network',
    'Status',
    'CPC Bid',
    'RPC',
    'Clicks',
    'Feeder Clicks',
    'Spend',
    'Revenue',
    'Net Profit',
    'ROAS %',
    'Margin %',
  ].join(',');

  const rows = keywords.map((k) =>
    [
      k.index,
      `"${k.keyword.replace(/"/g, '""')}"`,
      `"${k.vertical}"`,
      k.geo,
      k.feederName,
      k.network,
      k.status,
      k.cpcBid.toFixed(3),
      k.rpc.toFixed(3),
      k.clicks,
      k.feederClicks,
      k.spend.toFixed(2),
      k.revenue.toFixed(2),
      k.netProfit.toFixed(2),
      k.roasPct.toFixed(2),
      k.marginPct.toFixed(2),
    ].join(',')
  );

  return [header, ...rows].join('\n');
}

export function reportToCsv(report: ArbitrageReport): string {
  const lines = [
    `Report Title,"${report.title}"`,
    `Cadence,${report.cadence}`,
    `Period,${report.periodLabel}`,
    `Generated At,${report.generatedAt}`,
    `Total Spend,${report.totalSpend.toFixed(2)}`,
    `Total Revenue,${report.totalRevenue.toFixed(2)}`,
    `Net Profit,${report.netProfit.toFixed(2)}`,
    `Blended ROAS %,${report.blendedRoasPct.toFixed(2)}`,
    `Blended Margin %,${report.blendedMarginPct.toFixed(2)}`,
    '',
    'Feeder Breakdown',
    'Feeder,Active Keywords,Clicks,Spend,Revenue,Net Profit,ROAS %,Margin %',
    ...report.feederBreakdown.map((f) =>
      [
        f.feederName,
        f.activeKeywords,
        f.clicks,
        f.spend.toFixed(2),
        f.revenue.toFixed(2),
        f.netProfit.toFixed(2),
        f.roasPct.toFixed(2),
        f.marginPct.toFixed(2),
      ].join(',')
    ),
    '',
    'Top Keywords',
    'Keyword,Feeder,Network,Spend,Revenue,Net Profit,ROAS %',
    ...report.topKeywords.map((k) =>
      [
        `"${k.keyword.replace(/"/g, '""')}"`,
        k.feederName,
        k.network,
        k.spend.toFixed(2),
        k.revenue.toFixed(2),
        k.netProfit.toFixed(2),
        k.roasPct.toFixed(2),
      ].join(',')
    ),
  ];
  return lines.join('\n');
}

export function createInitialWorkspaceState(nowIso = new Date().toISOString()): WorkspaceState {
  const keywords = seedKeywords(1000, nowIso);
  const summary = computeSummary(keywords, 1, nowIso);
  const trendSeries = seedTrendSeries(summary, new Date(nowIso).getTime());

  const bidRules: BidRule[] = [
    {
      id: 'rule-scale-winners',
      name: 'Scale High-ROAS Feeders',
      enabled: true,
      network: 'All Networks',
      feeder: 'all',
      metric: 'roasPct',
      operator: 'gt',
      threshold: 145,
      minClicks: 120,
      actionType: 'increase_pct',
      actionValuePct: 8,
      executionCount: 42,
      lastExecutedAt: nowIso,
    },
    {
      id: 'rule-trim-meta',
      name: 'Trim Negative Margin on Meta Ads',
      enabled: true,
      network: 'Meta Ads',
      feeder: 'all',
      metric: 'roasPct',
      operator: 'lt',
      threshold: 92,
      minClicks: 80,
      actionType: 'decrease_pct',
      actionValuePct: 12,
      executionCount: 19,
      lastExecutedAt: nowIso,
    },
    {
      id: 'rule-protect-tonic',
      name: 'Protect Tonic RPC Floor',
      enabled: true,
      network: 'Google Ads',
      feeder: 'tonic',
      metric: 'marginPct',
      operator: 'lt',
      threshold: 10,
      minClicks: 100,
      actionType: 'decrease_pct',
      actionValuePct: 10,
      executionCount: 11,
      lastExecutedAt: nowIso,
    },
    {
      id: 'rule-stop-bleeders',
      name: 'Pause Extreme Bleeders',
      enabled: false,
      network: 'Taboola',
      feeder: 'all',
      metric: 'roasPct',
      operator: 'lt',
      threshold: 65,
      minClicks: 220,
      actionType: 'pause',
      actionValuePct: 0,
      executionCount: 4,
      lastExecutedAt: null,
    },
  ];

  const alertThresholds: AlertThreshold[] = [
    {
      id: 'th-global-roas',
      name: 'Blended ROAS Floor Breach',
      enabled: true,
      scope: 'global',
      scopeLabel: 'All Feeders (Blended)',
      metric: 'roasPct',
      operator: 'lt',
      threshold: 118,
      severity: 'critical',
      channel: 'Dashboard + Webhook',
    },
    {
      id: 'th-media-margin',
      name: 'Media.net Margin Compression',
      enabled: true,
      scope: 'media_net',
      scopeLabel: 'Media.net',
      metric: 'marginPct',
      operator: 'lt',
      threshold: 18,
      severity: 'warning',
      channel: 'Slack #arb-alerts',
    },
    {
      id: 'th-tonic-spend',
      name: 'Tonic Hourly Spend Velocity Cap',
      enabled: true,
      scope: 'tonic',
      scopeLabel: 'Tonic',
      metric: 'hourlySpend',
      operator: 'gt',
      threshold: 1500,
      severity: 'warning',
      channel: 'Dashboard + Webhook',
    },
    {
      id: 'th-system1-roas',
      name: 'System1 RSOC Efficiency Watch',
      enabled: true,
      scope: 'system1',
      scopeLabel: 'System1',
      metric: 'roasPct',
      operator: 'lt',
      threshold: 122,
      severity: 'info',
      channel: 'Slack #arb-alerts',
    },
  ];

  const integrations: ApiIntegrationConfig[] = [
    {
      id: 'int-medianet',
      provider: 'Media.net',
      providerType: 'feeder',
      feederId: 'media_net',
      endpointUrl: 'https://api.media.net/v2/arbitrage/reporting',
      webhookUrl: 'https://hooks.arbpulse.io/postback/medianet',
      syncIntervalSec: 30,
      status: 'connected',
      lastSyncAt: nowIso,
      recordsSyncedToday: 24810,
      maskedApiKey: 'mn_live_••••••••84a2',
      endpoints: { campaigns: true, keywords: true, conversions: true, postbacks: true },
    },
    {
      id: 'int-tonic',
      provider: 'Tonic',
      providerType: 'feeder',
      feederId: 'tonic',
      endpointUrl: 'https://api.tonic.com/v3/stats/keywords',
      webhookUrl: 'https://hooks.arbpulse.io/postback/tonic',
      syncIntervalSec: 15,
      status: 'connected',
      lastSyncAt: nowIso,
      recordsSyncedToday: 31420,
      maskedApiKey: 'tn_prod_••••••••39f1',
      endpoints: { campaigns: true, keywords: true, conversions: true, postbacks: true },
    },
    {
      id: 'int-system1',
      provider: 'System1',
      providerType: 'feeder',
      feederId: 'system1',
      endpointUrl: 'https://rsoc.system1.com/partner/v1/subids',
      webhookUrl: 'https://hooks.arbpulse.io/postback/system1',
      syncIntervalSec: 60,
      status: 'connected',
      lastSyncAt: nowIso,
      recordsSyncedToday: 19250,
      maskedApiKey: 's1_rsoc_••••••••72c9',
      endpoints: { campaigns: true, keywords: true, conversions: false, postbacks: true },
    },
    {
      id: 'int-meta',
      provider: 'Meta',
      providerType: 'feeder',
      feederId: 'meta',
      endpointUrl: 'https://graph.facebook.com/v21.0/act_90218/insights',
      webhookUrl: 'https://hooks.arbpulse.io/capi/meta',
      syncIntervalSec: 20,
      status: 'connected',
      lastSyncAt: nowIso,
      recordsSyncedToday: 44190,
      maskedApiKey: 'EAAG_live_••••••11d4',
      endpoints: { campaigns: true, keywords: true, conversions: true, postbacks: true },
    },
    {
      id: 'int-yahoo',
      provider: 'Yahoo',
      providerType: 'feeder',
      feederId: 'yahoo',
      endpointUrl: 'https://partner.search.yahoo.com/feeds/v4/hourly',
      webhookUrl: 'https://hooks.arbpulse.io/postback/yahoo',
      syncIntervalSec: 45,
      status: 'connected',
      lastSyncAt: nowIso,
      recordsSyncedToday: 21090,
      maskedApiKey: 'yh_part_••••••••55b8',
      endpoints: { campaigns: true, keywords: true, conversions: true, postbacks: false },
    },
    {
      id: 'int-google-ads',
      provider: 'Google Ads',
      providerType: 'network',
      endpointUrl: 'https://googleads.googleapis.com/v18/customers/441820',
      webhookUrl: 'https://hooks.arbpulse.io/gclid/sync',
      syncIntervalSec: 30,
      status: 'connected',
      lastSyncAt: nowIso,
      recordsSyncedToday: 38740,
      maskedApiKey: 'gads_oauth_••••••91e0',
      endpoints: { campaigns: true, keywords: true, conversions: true, postbacks: true },
    },
  ];

  const nowMs = new Date(nowIso).getTime();
  const syncLogs: ApiSyncLog[] = integrations.slice(0, 5).map((item, idx) => ({
    id: `sync-init-${idx + 1}`,
    timestamp: new Date(nowMs - (4 - idx) * 75 * 60 * 1000).toISOString(),
    provider: item.provider,
    endpoint: 'GET /keywords/metrics',
    httpStatus: 200,
    durationMs: 112 + idx * 24,
    recordsProcessed: 200,
    message: `Synchronized 200 keyword sub-IDs and RPC telemetry from ${item.provider}`,
  }));

  // Seed initial bid audit log from a quick initial pass, spread across intraday buckets
  const initialBids = evaluateBidRules(keywords.slice(0, 25), bidRules, nowIso);
  const spreadAuditEntries = initialBids.auditEntries.slice(0, 40).map((entry, idx) => {
    const bucketOffsetMin = [300, 240, 180, 120, 60, 15, 0][idx % 7];
    return {
      ...entry,
      timestamp: new Date(nowMs - bucketOffsetMin * 60 * 1000).toISOString(),
    };
  });
  const mergedKeywords = [...initialBids.keywords, ...keywords.slice(25)];
  const updatedSummary = computeSummary(mergedKeywords, 1, nowIso);
  const benchmarks = computeBenchmarks(mergedKeywords, updatedSummary);

  const initialAlerts: AlertEvent[] = [
    {
      id: 'alrt-seed-1',
      timestamp: new Date(nowMs - 45 * 60 * 1000).toISOString(),
      thresholdId: 'th-tonic-spend',
      title: 'Tonic Hourly Spend Velocity Cap',
      message: 'Tonic hourly spend pacing reached $1,582.40 (threshold > $1,500) during US morning surge',
      severity: 'warning',
      scopeLabel: 'Tonic',
      observedValue: 1582.4,
      thresholdValue: 1500,
      acknowledged: false,
    },
  ];

  const dailyReport = generateReport(
    'daily',
    mergedKeywords,
    updatedSummary,
    spreadAuditEntries.length,
    initialAlerts.length,
    true,
    nowIso
  );
  const weeklyReport = generateReport(
    'weekly',
    mergedKeywords,
    updatedSummary,
    spreadAuditEntries.length,
    initialAlerts.length,
    true,
    new Date(nowMs - 24 * 60 * 60 * 1000).toISOString()
  );

  return {
    summary: updatedSummary,
    keywords: mergedKeywords,
    trendSeries,
    bidRules: initialBids.rules,
    bidAuditLog: spreadAuditEntries,
    alertThresholds,
    alerts: initialAlerts,
    benchmarks,
    integrations,
    syncLogs,
    reports: [dailyReport, weeklyReport],
    autoBiddingEnabled: true,
  };
}
