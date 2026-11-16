import { useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { mapEventsToTrendSeries } from '../lib/arbitrageEngine';
import type {
  AlertEvent,
  ApiSyncLog,
  BidAuditEntry,
  DashboardSummary,
  FeederId,
  KeywordRecord,
  TimeSeriesPoint,
} from '../types/arbitrage';
import { formatCurrency, formatNumber, formatPct, formatTimeShort } from '../utils/format';
import { RevenueSpendChart } from './RevenueSpendChart';

interface OverviewViewProps {
  summary: DashboardSummary;
  trendSeries: TimeSeriesPoint[];
  keywords: KeywordRecord[];
  bidAuditLog: BidAuditEntry[];
  alerts: AlertEvent[];
  syncLogs: ApiSyncLog[];
  onNavigateKeywords: (feeder?: FeederId | 'all') => void;
  onNavigateView: (view: 'bidding' | 'benchmarks' | 'reports') => void;
  onAcknowledgeAlert: (id: string) => Promise<void>;
}

export function OverviewView({
  summary,
  trendSeries,
  keywords,
  bidAuditLog,
  alerts,
  syncLogs,
  onNavigateKeywords,
  onNavigateView,
  onAcknowledgeAlert,
}: OverviewViewProps) {
  const openAlerts = alerts.filter((a) => !a.acknowledged);
  const topWinners = [...keywords].sort((a, b) => b.netProfit - a.netProfit).slice(0, 6);
  const annotationsByIndex = useMemo(
    () => mapEventsToTrendSeries(trendSeries, bidAuditLog, alerts, syncLogs),
    [trendSeries, bidAuditLog, alerts, syncLogs]
  );

  return (
    <div className="space-y-6">
      {/* Primary KPI Strip */}
      <section
        aria-label="Live performance summary"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
      >
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Live Ad Spend</div>
          <div className="mt-1.5 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {formatCurrency(summary.totalSpend)}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            Avg CPC {formatCurrency(summary.avgCpc, 3)} · {formatNumber(summary.totalClicks)} clicks
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Gross Feeder Revenue</div>
          <div className="mt-1.5 text-2xl font-semibold text-teal-700 font-mono tabular-nums">
            {formatCurrency(summary.totalRevenue)}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            Avg RPC {formatCurrency(summary.avgRpc, 3)} · 5 active feeders
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Net Arbitrage Profit</div>
          <div
            className={`mt-1.5 text-2xl font-semibold font-mono tabular-nums ${
              summary.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {formatCurrency(summary.netProfit)}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            Margin {formatPct(summary.blendedMarginPct)} · {formatNumber(summary.activeKeywords)}/{formatNumber(summary.totalKeywords)} active
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Blended ROAS</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
              {formatPct(summary.blendedRoasPct)}
            </span>
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                summary.blendedRoasPct >= 100 ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {summary.blendedRoasPct >= 100 ? (
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {summary.blendedRoasPct >= 100 ? 'Profitable' : 'Under Water'}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            Last tick {formatTimeShort(summary.lastTickAt)}
          </div>
        </div>
      </section>

      {/* Main Chart + 5-Feeder Performance Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Real-Time Spend &amp; Revenue Trend
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Rolling intraday telemetry streamed from all 1,000 keywords
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateView('reports')}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              View Reports
            </button>
          </div>
          <RevenueSpendChart
            series={trendSeries}
            annotationsByIndex={annotationsByIndex}
          />
        </section>

        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Feeder Yield Breakdown
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Media.net, Tonic, System1, Meta &amp; Yahoo live settlement
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateKeywords('all')}
              className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
            >
              Inspect 1,000 Keywords
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                  <th className="py-2 pr-2">Feeder</th>
                  <th className="py-2 px-2 text-right">Spend</th>
                  <th className="py-2 px-2 text-right">Revenue</th>
                  <th className="py-2 px-2 text-right">Net Profit</th>
                  <th className="py-2 pl-2 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {summary.feederStats.map((f) => (
                  <tr key={f.feederId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 pr-2">
                      <button
                        type="button"
                        onClick={() => onNavigateKeywords(f.feederId)}
                        className="font-medium text-slate-900 hover:text-blue-700 text-left"
                      >
                        {f.feederName}
                      </button>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                        {f.activeKeywords} kw · {formatNumber(f.clicks)} clicks
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700">
                      {formatCurrency(f.spend, 0)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-900">
                      {formatCurrency(f.revenue, 0)}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-mono tabular-nums font-medium ${
                        f.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(f.netProfit, 0)}
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatPct(f.roasPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Bottom Row: Top Live Keywords + Auto-Bid Executions & Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-6 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="text-base font-semibold text-slate-900">
              Top Profitable Keywords (Live)
            </h2>
            <button
              type="button"
              onClick={() => onNavigateKeywords('all')}
              className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
            >
              Open Full Grid
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                  <th className="py-2 pr-2">Keyword</th>
                  <th className="py-2 px-2">Feeder / Net</th>
                  <th className="py-2 px-2 text-right">CPC</th>
                  <th className="py-2 px-2 text-right">Net Profit</th>
                  <th className="py-2 pl-2 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {topWinners.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50">
                    <td
                      title={k.keyword}
                      className="py-2 pr-2 font-medium text-slate-900 max-w-[185px] truncate"
                    >
                      {k.keyword}
                    </td>
                    <td className="py-2 px-2 text-slate-600 whitespace-nowrap">
                      {k.feederName} · {k.network}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-700">
                      {formatCurrency(k.cpcBid, 3)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums font-medium text-emerald-700">
                      {formatCurrency(k.netProfit)}
                    </td>
                    <td className="py-2 pl-2 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatPct(k.roasPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="xl:col-span-6 bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between gap-4 mb-2">
              <h2 className="text-base font-semibold text-slate-900">
                Active Threshold Alerts ({openAlerts.length})
              </h2>
              <button
                type="button"
                onClick={() => onNavigateView('benchmarks')}
                className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
              >
                Manage Thresholds
              </button>
            </div>
            {openAlerts.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                All custom performance thresholds are currently within target ranges.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {openAlerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className="py-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                        <span
                          className={
                            alert.severity === 'critical'
                              ? 'text-red-600'
                              : alert.severity === 'warning'
                                ? 'text-amber-700'
                                : 'text-blue-700'
                          }
                        >
                          {alert.severity === 'critical'
                            ? 'Critical'
                            : alert.severity === 'warning'
                              ? 'Warning'
                              : 'Notice'}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="truncate">{alert.title}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{alert.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onAcknowledgeAlert(alert.id)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded hover:bg-slate-50 shrink-0"
                    >
                      Acknowledge
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between gap-4 mb-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Recent Automated Bid Adjustments
              </h3>
              <button
                type="button"
                onClick={() => onNavigateView('bidding')}
                className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
              >
                Rule Engine
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {bidAuditLog.slice(0, 4).map((entry) => (
                <div key={entry.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <span className="font-medium text-slate-900">{entry.keyword}</span>
                    <span className="text-slate-400 mx-1.5">·</span>
                    <span className="text-slate-600">
                      {entry.network} / {entry.feederName}
                    </span>
                  </div>
                  <div className="font-mono tabular-nums whitespace-nowrap shrink-0">
                    <span className="text-slate-500">{formatCurrency(entry.previousBid, 3)}</span>
                    <span className="mx-1 text-slate-400">→</span>
                    <span
                      className={
                        entry.deltaPct > 0
                          ? 'text-emerald-700 font-medium'
                          : entry.deltaPct < 0
                            ? 'text-amber-700 font-medium'
                            : 'text-slate-700'
                      }
                    >
                      {formatCurrency(entry.newBid, 3)} ({entry.deltaPct > 0 ? '+' : ''}
                      {entry.deltaPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
