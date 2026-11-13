import { useState, type FormEvent } from 'react';
import { Play, Trash2 } from 'lucide-react';
import { AD_NETWORKS, FEEDER_LIST, FEEDERS } from '../lib/arbitrageEngine';

const METRIC_LABELS: Record<BidRuleMetric, string> = {
  roasPct: 'ROAS %',
  marginPct: 'Margin %',
  netProfit: 'Profit $',
  rpc: 'RPC $',
};
import type {
  AdNetwork,
  BidActionType,
  BidAuditEntry,
  BidRule,
  BidRuleMetric,
  BidRuleOperator,
  FeederId,
} from '../types/arbitrage';
import { formatCurrency, formatDateTime, formatNumber } from '../utils/format';

interface AutoBiddingViewProps {
  autoBiddingEnabled: boolean;
  bidRules: BidRule[];
  bidAuditLog: BidAuditEntry[];
  onToggleAutoBidding: (enabled: boolean) => Promise<void>;
  onCreateRule: (
    rule: Omit<BidRule, 'id' | 'executionCount' | 'lastExecutedAt'>
  ) => Promise<BidRule>;
  onToggleRule: (id: string, enabled: boolean) => Promise<void>;
  onDeleteRule: (id: string) => Promise<void>;
  onExecuteRules: () => Promise<number>;
}

export function AutoBiddingView({
  autoBiddingEnabled,
  bidRules,
  bidAuditLog,
  onToggleAutoBidding,
  onCreateRule,
  onToggleRule,
  onDeleteRule,
  onExecuteRules,
}: AutoBiddingViewProps) {
  const [name, setName] = useState('');
  const [network, setNetwork] = useState<AdNetwork | 'All Networks'>('Meta Ads');
  const [feeder, setFeeder] = useState<FeederId | 'all'>('all');
  const [metric, setMetric] = useState<BidRuleMetric>('roasPct');
  const [operator, setOperator] = useState<BidRuleOperator>('gt');
  const [threshold, setThreshold] = useState('140');
  const [minClicks, setMinClicks] = useState('80');
  const [actionType, setActionType] = useState<BidActionType>('increase_pct');
  const [actionValuePct, setActionValuePct] = useState('10');
  const [formError, setFormError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [lastRunMsg, setLastRunMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Rule name is required.');
      return;
    }
    const numThreshold = Number(threshold);
    const numClicks = Number(minClicks);
    const numPct = Number(actionValuePct);
    if (!Number.isFinite(numThreshold) || !Number.isFinite(numClicks)) {
      setFormError('Threshold and minimum clicks must be valid numbers.');
      return;
    }

    setFormError(null);
    await onCreateRule({
      name: name.trim(),
      enabled: true,
      network,
      feeder,
      metric,
      operator,
      threshold: numThreshold,
      minClicks: Math.max(0, numClicks),
      actionType,
      actionValuePct: actionType === 'pause' ? 0 : Math.max(1, numPct || 10),
    });
    setName('');
  };

  const handleExecuteNow = async () => {
    setRunning(true);
    try {
      const count = await onExecuteRules();
      setLastRunMsg(`Evaluated all 1,000 keywords: ${count} bid adjustments applied.`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Control Bar */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Automated Multi-Network Bid Adjustment Engine
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatically scales winning keywords and throttles negative-margin spend across Meta Ads, Google Ads, TikTok Ads, Taboola, and Bing Ads.
          </p>
          {lastRunMsg && (
            <p className="text-xs text-emerald-700 font-medium mt-1.5" role="status">
              {lastRunMsg}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => void onToggleAutoBidding(!autoBiddingEnabled)}
            className={`px-3.5 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
              autoBiddingEnabled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {autoBiddingEnabled ? 'Auto-Bidding: Active' : 'Auto-Bidding: Paused'}
          </button>

          <button
            type="button"
            disabled={running}
            onClick={() => void handleExecuteNow()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-md hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            {running ? 'Running Sweep...' : 'Execute Rules Now'}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Rule Builder Form */}
        <section className="xl:col-span-4 bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Create Bid Adjustment Rule
          </h3>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
            <div>
              <label htmlFor="rule-name" className="block text-xs font-medium text-slate-700 mb-1">
                Rule Name
              </label>
              <input
                id="rule-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Scale Meta High-ROAS Solar"
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="rule-network" className="block text-xs font-medium text-slate-700 mb-1">
                  Ad Network
                </label>
                <select
                  id="rule-network"
                  value={network}
                  onChange={(e) => setNetwork(e.target.value as AdNetwork | 'All Networks')}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white"
                >
                  <option value="All Networks">All Networks</option>
                  {AD_NETWORKS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="rule-feeder" className="block text-xs font-medium text-slate-700 mb-1">
                  Target Feeder
                </label>
                <select
                  id="rule-feeder"
                  value={feeder}
                  onChange={(e) => setFeeder(e.target.value as FeederId | 'all')}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white"
                >
                  <option value="all">All Feeders</option>
                  {FEEDER_LIST.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="rule-metric" className="block text-xs font-medium text-slate-700 mb-1">
                  Metric
                </label>
                <select
                  id="rule-metric"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as BidRuleMetric)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white"
                >
                  <option value="roasPct">ROAS %</option>
                  <option value="marginPct">Margin %</option>
                  <option value="netProfit">Profit $</option>
                  <option value="rpc">RPC $</option>
                </select>
              </div>

              <div>
                <label htmlFor="rule-op" className="block text-xs font-medium text-slate-700 mb-1">
                  Condition
                </label>
                <select
                  id="rule-op"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value as BidRuleOperator)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white"
                >
                  <option value="gt">&gt; Above</option>
                  <option value="lt">&lt; Below</option>
                </select>
              </div>

              <div>
                <label htmlFor="rule-threshold" className="block text-xs font-medium text-slate-700 mb-1">
                  Threshold
                </label>
                <input
                  id="rule-threshold"
                  type="number"
                  step="0.1"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="rule-clicks" className="block text-xs font-medium text-slate-700 mb-1">
                  Min Clicks
                </label>
                <input
                  id="rule-clicks"
                  type="number"
                  min="0"
                  value={minClicks}
                  onChange={(e) => setMinClicks(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md font-mono tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="rule-action" className="block text-xs font-medium text-slate-700 mb-1">
                  Action
                </label>
                <select
                  id="rule-action"
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as BidActionType)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white"
                >
                  <option value="increase_pct">+ Bid %</option>
                  <option value="decrease_pct">- Bid %</option>
                  <option value="pause">Pause</option>
                </select>
              </div>

              <div>
                <label htmlFor="rule-pct" className="block text-xs font-medium text-slate-700 mb-1">
                  Step %
                </label>
                <input
                  id="rule-pct"
                  type="number"
                  min="1"
                  max="50"
                  disabled={actionType === 'pause'}
                  value={actionValuePct}
                  onChange={(e) => setActionValuePct(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md font-mono tabular-nums disabled:bg-slate-50"
                />
              </div>
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
              Add Automated Bid Rule
            </button>
          </form>
        </section>

        {/* Active Rules Table */}
        <section className="xl:col-span-8 bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Configured Bidding Rules ({bidRules.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                  <th className="py-2 pr-3">Rule</th>
                  <th className="py-2 px-2">Scope</th>
                  <th className="py-2 px-2">Trigger Condition</th>
                  <th className="py-2 px-2">Adjustment</th>
                  <th className="py-2 px-2 text-right">Runs</th>
                  <th className="py-2 pl-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {bidRules.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-3 font-medium text-slate-900">{r.name}</td>
                    <td className="py-3 px-2 text-slate-600 whitespace-nowrap">
                      {r.network} · {r.feeder === 'all' ? 'All Feeders' : FEEDERS[r.feeder]?.name ?? r.feeder}
                    </td>
                    <td className="py-3 px-2 font-mono tabular-nums text-slate-700">
                      {METRIC_LABELS[r.metric]} {r.operator === 'gt' ? '>' : '<'} {r.threshold} (≥{r.minClicks} clicks)
                    </td>
                    <td className="py-3 px-2 font-medium whitespace-nowrap">
                      {r.actionType === 'pause' ? (
                        <span className="text-red-600">Pause Keyword</span>
                      ) : r.actionType === 'increase_pct' ? (
                        <span className="text-emerald-700">+{r.actionValuePct}% CPC</span>
                      ) : (
                        <span className="text-amber-700">-{r.actionValuePct}% CPC</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right font-mono tabular-nums text-slate-700">
                      {formatNumber(r.executionCount)}
                    </td>
                    <td className="py-3 pl-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void onToggleRule(r.id, !r.enabled)}
                          className={`px-2 py-1 text-[11px] font-medium rounded border ${
                            r.enabled
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-slate-50 text-slate-600'
                          }`}
                        >
                          {r.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete rule ${r.name}`}
                          onClick={() => void onDeleteRule(r.id)}
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
        </section>
      </div>

      {/* Execution Audit Log */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Live Bid Adjustment Audit Log ({bidAuditLog.length})
        </h3>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                <th className="py-2 pr-3">Timestamp</th>
                <th className="py-2 px-2">Rule / Source</th>
                <th className="py-2 px-2">Keyword</th>
                <th className="py-2 px-2">Network · Feeder</th>
                <th className="py-2 px-2 text-right">Prev CPC</th>
                <th className="py-2 px-2 text-right">New CPC</th>
                <th className="py-2 pl-2">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {bidAuditLog.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="py-2 pr-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    {formatDateTime(entry.timestamp)}
                  </td>
                  <td className="py-2 px-2 font-medium text-slate-900 whitespace-nowrap">
                    {entry.ruleName}
                  </td>
                  <td className="py-2 px-2 text-slate-800">{entry.keyword}</td>
                  <td className="py-2 px-2 text-slate-600 whitespace-nowrap">
                    {entry.network} · {entry.feederName}
                  </td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-500">
                    {formatCurrency(entry.previousBid, 3)}
                  </td>
                  <td
                    className={`py-2 px-2 text-right font-mono tabular-nums font-medium ${
                      entry.deltaPct > 0
                        ? 'text-emerald-700'
                        : entry.deltaPct < 0
                          ? 'text-amber-700'
                          : 'text-slate-700'
                    }`}
                  >
                    {formatCurrency(entry.newBid, 3)} ({entry.deltaPct > 0 ? '+' : ''}
                    {entry.deltaPct.toFixed(1)}%)
                  </td>
                  <td className="py-2 pl-2 text-slate-600">{entry.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
