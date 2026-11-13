export type FeederId = 'media_net' | 'tonic' | 'system1' | 'meta' | 'yahoo';

export type AdNetwork = 'Meta Ads' | 'Google Ads' | 'TikTok Ads' | 'Taboola' | 'Bing Ads';

export type KeywordStatus = 'active' | 'scaling' | 'paused' | 'throttled';

export interface FeederMeta {
  id: FeederId;
  name: string;
  domain: string;
  settlementWindow: string;
  revSharePct: number;
}

export interface KeywordRecord {
  id: string;
  index: number;
  keyword: string;
  vertical: string;
  geo: 'US' | 'CA' | 'UK' | 'AU' | 'DE';
  feeder: FeederId;
  feederName: string;
  network: AdNetwork;
  campaignName: string;
  status: KeywordStatus;
  cpcBid: number;
  maxBidCap: number;
  minBidFloor: number;
  impressions: number;
  clicks: number;
  feederClicks: number;
  rpc: number;
  spend: number;
  revenue: number;
  netProfit: number;
  roasPct: number;
  marginPct: number;
  ctrPct: number;
  lastBidChangePct: number;
  lastUpdatedAt: string;
}

export interface TimeSeriesPoint {
  timestamp: string;
  label: string;
  spend: number;
  revenue: number;
  netProfit: number;
  roasPct: number;
  clicks: number;
}

export type TrendAnnotationKind =
  | 'bid_increase'
  | 'bid_decrease'
  | 'alert'
  | 'campaign_event';

export interface TrendAnnotation {
  id: string;
  pointIndex: number;
  timestamp: string;
  kind: TrendAnnotationKind;
  title: string;
  detail: string;
  meta: string;
}

export type BidRuleMetric = 'roasPct' | 'marginPct' | 'netProfit' | 'rpc';
export type BidRuleOperator = 'gt' | 'lt';
export type BidActionType = 'increase_pct' | 'decrease_pct' | 'pause';

export interface BidRule {
  id: string;
  name: string;
  enabled: boolean;
  network: AdNetwork | 'All Networks';
  feeder: FeederId | 'all';
  metric: BidRuleMetric;
  operator: BidRuleOperator;
  threshold: number;
  minClicks: number;
  actionType: BidActionType;
  actionValuePct: number;
  executionCount: number;
  lastExecutedAt: string | null;
}

export interface BidAuditEntry {
  id: string;
  timestamp: string;
  ruleId: string;
  ruleName: string;
  keywordId: string;
  keyword: string;
  network: AdNetwork;
  feederName: string;
  previousBid: number;
  newBid: number;
  deltaPct: number;
  reason: string;
  automated: boolean;
}

export type AlertMetric = 'marginPct' | 'roasPct' | 'hourlySpend' | 'rpcDropPct';
export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertThreshold {
  id: string;
  name: string;
  enabled: boolean;
  scope: FeederId | 'global';
  scopeLabel: string;
  metric: AlertMetric;
  operator: 'lt' | 'gt';
  threshold: number;
  severity: AlertSeverity;
  channel: 'Dashboard + Webhook' | 'Slack #arb-alerts' | 'PagerDuty';
}

export interface AlertEvent {
  id: string;
  timestamp: string;
  thresholdId: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  scopeLabel: string;
  observedValue: number;
  thresholdValue: number;
  acknowledged: boolean;
}

export interface BenchmarkEntry {
  id: string;
  label: string;
  category: 'feeder' | 'network';
  todaySpend: number;
  todayRevenue: number;
  todayRoasPct: number;
  todayMarginPct: number;
  avg7dRoasPct: number;
  avg30dRoasPct: number;
  avg7dMarginPct: number;
  avg30dMarginPct: number;
  deltaVs7dPct: number;
  deltaVs30dPct: number;
}

export interface ApiIntegrationConfig {
  id: string;
  provider: string;
  providerType: 'feeder' | 'network';
  feederId?: FeederId;
  endpointUrl: string;
  webhookUrl: string;
  syncIntervalSec: number;
  status: 'connected' | 'syncing' | 'rate_limited';
  lastSyncAt: string;
  recordsSyncedToday: number;
  maskedApiKey: string;
  endpoints: {
    campaigns: boolean;
    keywords: boolean;
    conversions: boolean;
    postbacks: boolean;
  };
}

export interface ApiSyncLog {
  id: string;
  timestamp: string;
  provider: string;
  endpoint: string;
  httpStatus: number;
  durationMs: number;
  recordsProcessed: number;
  message: string;
}

export interface ReportFeederBreakdown {
  feederId: FeederId;
  feederName: string;
  activeKeywords: number;
  spend: number;
  revenue: number;
  netProfit: number;
  roasPct: number;
  marginPct: number;
  clicks: number;
}

export interface ArbitrageReport {
  id: string;
  cadence: 'daily' | 'weekly';
  title: string;
  periodLabel: string;
  generatedAt: string;
  autoScheduled: boolean;
  totalSpend: number;
  totalRevenue: number;
  netProfit: number;
  blendedRoasPct: number;
  blendedMarginPct: number;
  totalClicks: number;
  bidAdjustmentsApplied: number;
  alertsTriggered: number;
  feederBreakdown: ReportFeederBreakdown[];
  topKeywords: Array<{
    keyword: string;
    feederName: string;
    network: AdNetwork;
    spend: number;
    revenue: number;
    netProfit: number;
    roasPct: number;
  }>;
}

export interface DashboardSummary {
  totalKeywords: number;
  activeKeywords: number;
  totalSpend: number;
  totalRevenue: number;
  netProfit: number;
  blendedRoasPct: number;
  blendedMarginPct: number;
  totalClicks: number;
  avgCpc: number;
  avgRpc: number;
  tickCount: number;
  lastTickAt: string;
  feederStats: ReportFeederBreakdown[];
}

export interface WorkspaceState {
  summary: DashboardSummary;
  keywords: KeywordRecord[];
  trendSeries: TimeSeriesPoint[];
  bidRules: BidRule[];
  bidAuditLog: BidAuditEntry[];
  alertThresholds: AlertThreshold[];
  alerts: AlertEvent[];
  benchmarks: BenchmarkEntry[];
  integrations: ApiIntegrationConfig[];
  syncLogs: ApiSyncLog[];
  reports: ArbitrageReport[];
  autoBiddingEnabled: boolean;
}
