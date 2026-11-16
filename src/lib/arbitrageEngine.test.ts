import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateKeywordColumnFitWidth,
  computeBenchmarks,
  computeKeywordMetrics,
  computeSummary,
  createInitialWorkspaceState,
  DEFAULT_KEYWORD_COL_WIDTH,
  evaluateAlertThresholds,
  evaluateBidRules,
  generateReport,
  keywordsToCsv,
  mapEventsToTrendSeries,
  MAX_KEYWORD_COL_WIDTH,
  MIN_KEYWORD_COL_WIDTH,
  processLiveTick,
  reportToCsv,
  seedKeywords,
} from './arbitrageEngine';

test('seedKeywords creates exactly 1,000 unique keywords across all 5 feeders', () => {
  const keywords = seedKeywords(1000, '2026-11-13T12:00:00.000Z');
  assert.equal(keywords.length, 1000);

  const uniqueTerms = new Set(keywords.map((k) => k.keyword));
  assert.equal(uniqueTerms.size, 1000);

  const feeders = new Set(keywords.map((k) => k.feeder));
  assert.deepEqual(
    [...feeders].sort(),
    ['media_net', 'meta', 'system1', 'tonic', 'yahoo']
  );
});

test('computeKeywordMetrics calculates spend, revenue, profit, ROAS, and margin accurately', () => {
  const m = computeKeywordMetrics(100, 80, 0.5, 0.9, 2500);
  assert.equal(m.spend, 50);
  assert.equal(m.revenue, 72);
  assert.equal(m.netProfit, 22);
  assert.equal(m.roasPct, 144);
  assert.equal(m.marginPct, 30.56);
  assert.equal(m.ctrPct, 4);
});

test('processLiveTick advances metrics and maintains 1,000 keywords', () => {
  const state = createInitialWorkspaceState('2026-11-13T12:00:00.000Z');
  const next = processLiveTick(
    state.keywords,
    state.trendSeries,
    2,
    '2026-11-13T12:00:02.000Z'
  );
  assert.equal(next.keywords.length, 1000);
  assert.ok(next.updatedIds.length > 50);
  assert.ok(next.summary.totalSpend >= state.summary.totalSpend);
  assert.ok(next.summary.totalRevenue >= state.summary.totalRevenue);
});

test('evaluateBidRules respects minClicks and bid caps when scaling bids', () => {
  const kws = seedKeywords(10, '2026-11-13T12:00:00.000Z').map((k, idx) => ({
    ...k,
    status: 'active' as const,
    network: 'Meta Ads' as const,
    clicks: idx === 0 ? 200 : 10,
    roasPct: 170,
    cpcBid: 0.5,
    maxBidCap: 0.55,
  }));

  const rules = [
    {
      id: 'r1',
      name: 'Scale Meta Winners',
      enabled: true,
      network: 'Meta Ads' as const,
      feeder: 'all' as const,
      metric: 'roasPct' as const,
      operator: 'gt' as const,
      threshold: 150,
      minClicks: 100,
      actionType: 'increase_pct' as const,
      actionValuePct: 20,
      executionCount: 0,
      lastExecutedAt: null,
    },
  ];

  const res = evaluateBidRules(kws, rules, '2026-11-13T12:05:00.000Z');
  assert.equal(res.auditEntries.length, 1);
  // Clamped to maxBidCap (0.55) instead of 0.60
  assert.equal(res.keywords[0].cpcBid, 0.55);
  assert.equal(res.keywords[1].cpcBid, 0.5);
  assert.equal(res.rules[0].executionCount, 1);
});

test('evaluateAlertThresholds triggers new alert when threshold is breached', () => {
  const state = createInitialWorkspaceState('2026-11-13T12:00:00.000Z');
  const summary = computeSummary(state.keywords, 1, '2026-11-13T12:00:00.000Z');
  const alerts = evaluateAlertThresholds(
    summary,
    [
      {
        id: 'th-test-breach',
        name: 'Impossible High ROAS Alert',
        enabled: true,
        scope: 'global',
        scopeLabel: 'All Feeders',
        metric: 'roasPct',
        operator: 'lt',
        threshold: 999,
        severity: 'critical',
        channel: 'Dashboard + Webhook',
      },
    ],
    [],
    '2026-11-13T12:01:00.000Z'
  );
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].severity, 'critical');
});

test('computeBenchmarks returns entries for all 5 feeders and 5 ad networks', () => {
  const state = createInitialWorkspaceState('2026-11-13T12:00:00.000Z');
  const benchmarks = computeBenchmarks(state.keywords, state.summary);
  assert.equal(benchmarks.length, 10);
  assert.equal(benchmarks.filter((b) => b.category === 'feeder').length, 5);
  assert.equal(benchmarks.filter((b) => b.category === 'network').length, 5);
});

test('generateReport and CSV serialization produce valid daily and weekly reports', () => {
  const state = createInitialWorkspaceState('2026-11-13T12:00:00.000Z');
  const daily = generateReport('daily', state.keywords, state.summary, 12, 2, true);
  const weekly = generateReport('weekly', state.keywords, state.summary, 12, 2, false);

  assert.equal(daily.feederBreakdown.length, 5);
  assert.equal(daily.topKeywords.length, 8);
  assert.ok(weekly.totalSpend > daily.totalSpend);

  const rCsv = reportToCsv(daily);
  assert.ok(rCsv.includes('Media.net'));
  assert.ok(rCsv.includes('Tonic'));

  const kCsv = keywordsToCsv(state.keywords.slice(0, 5));
  assert.equal(kCsv.split('\n').length, 6);
});

test('mapEventsToTrendSeries maps bid changes, alerts, and sync events to nearest chart points', () => {
  const state = createInitialWorkspaceState('2026-11-13T12:00:00.000Z');
  const mapped = mapEventsToTrendSeries(
    state.trendSeries,
    state.bidAuditLog,
    state.alerts,
    state.syncLogs
  );

  const bucketIndices = Object.keys(mapped).map(Number);
  assert.ok(bucketIndices.length >= 4);

  const allAnnotations = Object.values(mapped).flat();
  assert.ok(allAnnotations.some((a) => a.kind === 'bid_increase' || a.kind === 'bid_decrease'));
  assert.ok(allAnnotations.some((a) => a.kind === 'alert'));
  assert.ok(allAnnotations.some((a) => a.kind === 'campaign_event'));
});

test('calculateKeywordColumnFitWidth sizes to longest keyword within min/max bounds', () => {
  assert.equal(calculateKeywordColumnFitWidth([]), DEFAULT_KEYWORD_COL_WIDTH);

  const shortWidth = calculateKeywordColumnFitWidth([
    { keyword: 'hi', vertical: 'Auto', geo: 'US' },
  ]);
  assert.equal(shortWidth, MIN_KEYWORD_COL_WIDTH);

  const seeded = seedKeywords(1000, '2026-11-13T12:00:00.000Z');
  const fitWidth = calculateKeywordColumnFitWidth(seeded);
  assert.ok(fitWidth > DEFAULT_KEYWORD_COL_WIDTH);
  assert.ok(fitWidth <= MAX_KEYWORD_COL_WIDTH);

  const hugeWidth = calculateKeywordColumnFitWidth([
    { keyword: 'x'.repeat(200), vertical: 'Legal Services', geo: 'US' },
  ]);
  assert.equal(hugeWidth, MAX_KEYWORD_COL_WIDTH);
});

