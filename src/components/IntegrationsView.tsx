import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ApiIntegrationConfig, ApiSyncLog } from '../types/arbitrage';
import { formatDateTime, formatNumber } from '../utils/format';

interface IntegrationsViewProps {
  integrations: ApiIntegrationConfig[];
  syncLogs: ApiSyncLog[];
  onSyncNow: (id: string, endpointScope?: string) => Promise<void>;
  onUpdateIntegration: (
    id: string,
    patch: {
      syncIntervalSec?: number;
      endpoints?: Partial<ApiIntegrationConfig['endpoints']>;
    }
  ) => Promise<void>;
}

export function IntegrationsView({
  integrations,
  syncLogs,
  onSyncNow,
  onUpdateIntegration,
}: IntegrationsViewProps) {
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSync = async (id: string, scope?: string) => {
    setSyncingId(id);
    try {
      await onSyncNow(id, scope);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Granular Feeder &amp; Ad Network API Integrations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Direct REST &amp; server-to-server postback connectors for Media.net, Tonic, System1, Meta, Yahoo, and Google Ads. Configure per-endpoint sync scopes and polling intervals.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {integrations.map((intg) => {
            const isSyncing = syncingId === intg.id;
            return (
              <div
                key={intg.id}
                className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {intg.provider}
                        </h3>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500 capitalize">
                          {intg.providerType} API
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] font-mono text-slate-500 break-all">
                        {intg.endpointUrl}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={() => void handleSync(intg.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-700 text-white rounded-md hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-xs">
                    <div>
                      <div className="text-[11px] text-slate-500">Key Token</div>
                      <div className="font-mono text-slate-800 truncate">{intg.maskedApiKey}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Synced Today</div>
                      <div className="font-mono tabular-nums text-slate-900 font-medium">
                        {formatNumber(intg.recordsSyncedToday)} rows
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor={`cadence-${intg.id}`}
                        className="block text-[11px] text-slate-500"
                      >
                        Poll Interval
                      </label>
                      <select
                        id={`cadence-${intg.id}`}
                        value={intg.syncIntervalSec}
                        onChange={(e) =>
                          void onUpdateIntegration(intg.id, {
                            syncIntervalSec: Number(e.target.value),
                          })
                        }
                        className="mt-0.5 text-xs font-mono border border-slate-200 rounded px-1.5 py-0.5 bg-white"
                      >
                        <option value={15}>15s</option>
                        <option value={30}>30s</option>
                        <option value={45}>45s</option>
                        <option value={60}>60s</option>
                        <option value={300}>300s</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="text-[11px] font-medium text-slate-500 mb-2">
                      Granular Endpoint Scopes
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['campaigns', 'keywords', 'conversions', 'postbacks'] as const).map(
                        (scope) => {
                          const active = intg.endpoints[scope];
                          return (
                            <label
                              key={scope}
                              className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={(e) =>
                                  void onUpdateIntegration(intg.id, {
                                    endpoints: { [scope]: e.target.checked },
                                  })
                                }
                                className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                              />
                              <span className="capitalize">{scope}</span>
                            </label>
                          );
                        }
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span className="font-mono truncate max-w-[260px]">
                    Postback: {intg.webhookUrl}
                  </span>
                  <span className="font-mono tabular-nums whitespace-nowrap">
                    Last: {formatDateTime(intg.lastSyncAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Live API Sync Telemetry Log */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Granular API Sync Log ({syncLogs.length})
        </h3>
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                <th className="py-2 pr-3">Timestamp</th>
                <th className="py-2 px-2">Provider</th>
                <th className="py-2 px-2">Endpoint</th>
                <th className="py-2 px-2 text-right">HTTP</th>
                <th className="py-2 px-2 text-right">Latency</th>
                <th className="py-2 px-2 text-right">Records</th>
                <th className="py-2 pl-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {syncLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-2 pr-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    {formatDateTime(log.timestamp)}
                  </td>
                  <td className="py-2 px-2 font-medium text-slate-900 whitespace-nowrap">
                    {log.provider}
                  </td>
                  <td className="py-2 px-2 font-mono text-slate-700 whitespace-nowrap">
                    {log.endpoint}
                  </td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums text-emerald-700">
                    {log.httpStatus}
                  </td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-600">
                    {log.durationMs}ms
                  </td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-800">
                    {formatNumber(log.recordsProcessed)}
                  </td>
                  <td className="py-2 pl-2 text-slate-600">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
