import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { FEEDER_LIST } from '../lib/arbitrageEngine';
import type {
  AlertEvent,
  AlertMetric,
  AlertSeverity,
  AlertThreshold,
  BenchmarkEntry,
  FeederId,
} from '../types/arbitrage';
import { formatCurrency, formatDateTime, formatPct } from '../utils/format';

const ALERT_METRIC_LABELS: Record<AlertMetric, string> = {
  marginPct: 'Margin %',
  roasPct: 'ROAS %',
  hourlySpend: 'Hourly Spend $',
  rpcDropPct: 'RPC Drop %',
};

interface BenchmarksAlertsViewProps {
  benchmarks: BenchmarkEntry[];
  alertThresholds: AlertThreshold[];
  alerts: AlertEvent[];
  onCreateThreshold: (
    threshold: Omit<AlertThreshold, 'id' | 'scopeLabel'>
  ) => Promise<void>;
  onToggleThreshold: (id: string, enabled: boolean) => Promise<void>;
  onDeleteThreshold: (id: string) => Promise<void>;
  onAcknowledgeAlert: (id: string) => Promise<void>;
}

export function BenchmarksAlertsView({
  benchmarks,
  alertThresholds,
  alerts,
  onCreateThreshold,
  onToggleThreshold,
  onDeleteThreshold,
  onAcknowledgeAlert,
}: BenchmarksAlertsViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<'feeder' | 'network'>('feeder');
  const [name, setName] = useState('');
  const [scope, setScope] = useState<FeederId | 'global'>('global');
  const [metric, setMetric] = useState<AlertMetric>('marginPct');
  const [operator, setOperator] = useState<'lt' | 'gt'>('lt');
  const [threshold, setThreshold] = useState('18');
  const [severity, setSeverity] = useState<AlertSeverity>('warning');
  const [channel, setChannel] = useState<AlertThreshold['channel']>('Dashboard + Webhook');
  const [formError, setFormError] = useState<string | null>(null);

  const visibleBenchmarks = benchmarks.filter((b) => b.category === categoryFilter);
  const maxRoas = Math.max(
    160,
    ...visibleBenchmarks.flatMap((b) => [b.todayRoasPct, b.avg7dRoasPct, b.avg30dRoasPct])
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Alert rule name is required.');
      return;
    }
    const numVal = Number(threshold);
    if (!Number.isFinite(numVal)) {
      setFormError('Threshold value must be a valid number.');
      return;
    }
    setFormError(null);
    await onCreateThreshold({
      name: name.trim(),
      enabled: true,
      scope,
      metric,
      operator,
      threshold: numVal,
      severity,
      channel,
    });
    setName('');
  };

  return (
    <div className="space-y-6">
      {/* Historical Performance Benchmarking */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Historical Performance Benchmarking
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Compare live intraday ROAS &amp; margin against 7-day and 30-day rolling baselines
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setCategoryFilter('feeder')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                categoryFilter === 'feeder'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Feeder (5)
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('network')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                categoryFilter === 'network'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Ad Network (5)
            </button>
          </div>
        </div>

        {/* Visual Grouped Bar Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-2">
          {visibleBenchmarks.map((item) => (
            <div key={item.id} className="border border-slate-200 rounded-md p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 truncate">
                  {item.label}
                </span>
                <span
                  className={`text-[11px] font-mono tabular-nums font-medium ${
                    item.deltaVs7dPct >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {item.deltaVs7dPct >= 0 ? '+' : ''}
                  {item.deltaVs7dPct.toFixed(1)}% vs 7D
                </span>
              </div>

              <div className="mt-3 space-y-2 text-[11px] font-mono tabular-nums">
                <div>
                  <div className="flex justify-between text-slate-600 mb-0.5">
                    <span>Today</span>
                    <span className="font-semibold text-slate-900">
                      {formatPct(item.todayRoasPct)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-xs overflow-hidden">
                    <div
                      className="h-full bg-teal-600"
                      style={{ width: `${Math.min(100, (item.todayRoasPct / maxRoas) * 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-500 mb-0.5">
                    <span>7D Avg</span>
                    <span>{formatPct(item.avg7dRoasPct)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-xs overflow-hidden">
                    <div
                      className="h-full bg-blue-600"
                      style={{ width: `${Math.min(100, (item.avg7dRoasPct / maxRoas) * 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-500 mb-0.5">
                    <span>30D Avg</span>
                    <span>{formatPct(item.avg30dRoasPct)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-xs overflow-hidden">
                    <div
                      className="h-full bg-slate-400"
                      style={{ width: `${Math.min(100, (item.avg30dRoasPct / maxRoas) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                <th className="py-2 pr-3">Entity</th>
                <th className="py-2 px-2 text-right">Today Spend</th>
                <th className="py-2 px-2 text-right">Today Revenue</th>
                <th className="py-2 px-2 text-right">Today ROAS</th>
                <th className="py-2 px-2 text-right">7D ROAS</th>
                <th className="py-2 px-2 text-right">30D ROAS</th>
                <th className="py-2 px-2 text-right">Today Margin</th>
                <th className="py-2 pl-2 text-right">vs 30D Baseline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {visibleBenchmarks.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-3 font-medium text-slate-900">{b.label}</td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700">
                    {formatCurrency(b.todaySpend, 0)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-900">
                    {formatCurrency(b.todayRevenue, 0)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {formatPct(b.todayRoasPct)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600">
                    {formatPct(b.avg7dRoasPct)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600">
                    {formatPct(b.avg30dRoasPct)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700">
                    {formatPct(b.todayMarginPct)}
                  </td>
                  <td
                    className={`py-2.5 pl-2 text-right font-mono tabular-nums font-medium ${
                      b.deltaVs30dPct >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {b.deltaVs30dPct >= 0 ? '+' : ''}
                    {b.deltaVs30dPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Custom Alert Thresholds & Live Alert Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <section className="xl:col-span-4 bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Add Custom Alert Threshold
          </h3>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
            <div>
              <label htmlFor="alert-name" className="block text-xs font-medium text-slate-700 mb-1">
                Threshold Name
              </label>
              <input
                id="alert-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Yahoo Margin Floor Alert"
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="alert-scope" className="block text-xs font-medium text-slate-700 mb-1">
                  Scope
                </label>
                <select
                  id="alert-scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as FeederId | 'global')}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white"
                >
                  <option value="global">All Feeders (Blended)</option>
                  {FEEDER_LIST.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="alert-metric" className="block text-xs font-medium text-slate-700 mb-1">
                  Metric
                </label>
                <select
                  id="alert-metric"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as AlertMetric)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white"
                >
                  <option value="marginPct">Margin %</option>
                  <option value="roasPct">ROAS %</option>
                  <option value="hourlySpend">Hourly Spend $</option>
                  <option value="rpcDropPct">RPC Drop %</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="alert-op" className="block text-xs font-medium text-slate-700 mb-1">
                  Condition
                </label>
                <select
                  id="alert-op"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value as 'lt' | 'gt')}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white"
                >
                  <option value="lt">Below (&lt;)</option>
                  <option value="gt">Above (&gt;)</option>
                </select>
              </div>

              <div>
                <label htmlFor="alert-val" className="block text-xs font-medium text-slate-700 mb-1">
                  Value
                </label>
                <input
                  id="alert-val"
                  type="number"
                  step="0.1"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md font-mono tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="alert-sev" className="block text-xs font-medium text-slate-700 mb-1">
                  Severity
                </label>
                <select
                  id="alert-sev"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white"
                >
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="info">Notice</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="alert-channel" className="block text-xs font-medium text-slate-700 mb-1">
                Notification Channel
              </label>
              <select
                id="alert-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value as AlertThreshold['channel'])}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white"
              >
                <option value="Dashboard + Webhook">Dashboard + Webhook</option>
                <option value="Slack #arb-alerts">Slack #arb-alerts</option>
                <option value="PagerDuty">PagerDuty</option>
              </select>
            </div>

            {formError && (
              <p className="text-xs text-red-600" role="alert">
                {formError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2 px-4 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors"
            >
              Save Alert Threshold
            </button>
          </form>
        </section>

        <section className="xl:col-span-8 bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Active Threshold Rules ({alertThresholds.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                    <th className="py-2 pr-2">Rule Name</th>
                    <th className="py-2 px-2">Scope</th>
                    <th className="py-2 px-2">Trigger</th>
                    <th className="py-2 px-2">Channel</th>
                    <th className="py-2 pl-2 text-right">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {alertThresholds.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-2 font-medium text-slate-900">
                        <span
                          className={`mr-1.5 ${
                            t.severity === 'critical'
                              ? 'text-red-600'
                              : t.severity === 'warning'
                                ? 'text-amber-700'
                                : 'text-blue-700'
                          }`}
                        >
                          {t.severity === 'critical'
                            ? 'Critical'
                            : t.severity === 'warning'
                              ? 'Warning'
                              : 'Notice'} ·
                        </span>
                        {t.name}
                      </td>
                      <td className="py-2.5 px-2 text-slate-600">{t.scopeLabel}</td>
                      <td className="py-2.5 px-2 font-mono tabular-nums text-slate-700">
                        {ALERT_METRIC_LABELS[t.metric]} {t.operator === 'lt' ? '<' : '>'} {t.threshold}
                      </td>
                      <td className="py-2.5 px-2 text-slate-600">{t.channel}</td>
                      <td className="py-2.5 pl-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void onToggleThreshold(t.id, !t.enabled)}
                            className={`px-2 py-1 text-[11px] font-medium rounded border ${
                              t.enabled
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-slate-200 bg-slate-50 text-slate-600'
                            }`}
                          >
                            {t.enabled ? 'Active' : 'Muted'}
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete threshold ${t.name}`}
                            onClick={() => void onDeleteThreshold(t.id)}
                            className="p-1 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Triggered Optimization Alerts ({alerts.length})
            </h3>
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {alerts.map((a) => (
                <div key={a.id} className="py-2.5 flex items-start justify-between gap-4 text-xs">
                  <div>
                    <div className="font-medium text-slate-900">
                      <span
                        className={
                          a.severity === 'critical'
                            ? 'text-red-600 mr-1.5'
                            : a.severity === 'warning'
                              ? 'text-amber-700 mr-1.5'
                              : 'text-blue-700 mr-1.5'
                        }
                      >
                        {a.severity === 'critical'
                          ? 'Critical'
                          : a.severity === 'warning'
                            ? 'Warning'
                            : 'Notice'} ·
                      </span>
                      {a.title}
                      <span className="text-slate-400 font-mono tabular-nums ml-2">
                        {formatDateTime(a.timestamp)}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-0.5">{a.message}</p>
                  </div>
                  {a.acknowledged ? (
                    <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                      Acknowledged
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void onAcknowledgeAlert(a.id)}
                      className="px-2.5 py-1 text-[11px] font-medium border border-slate-200 rounded hover:bg-slate-50 shrink-0"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
