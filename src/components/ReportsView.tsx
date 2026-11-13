import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { reportToCsv } from '../lib/arbitrageEngine';
import type { ArbitrageReport } from '../types/arbitrage';
import { formatCurrency, formatDateTime, formatNumber, formatPct } from '../utils/format';

interface ReportsViewProps {
  reports: ArbitrageReport[];
  onGenerateReport: (cadence: 'daily' | 'weekly') => Promise<ArbitrageReport>;
}

export function ReportsView({ reports, onGenerateReport }: ReportsViewProps) {
  const [selectedId, setSelectedId] = useState<string>(reports[0]?.id ?? '');
  const [generating, setGenerating] = useState<'daily' | 'weekly' | null>(null);

  const activeReport =
    reports.find((r) => r.id === selectedId) ?? reports[0] ?? null;

  const handleGenerate = async (cadence: 'daily' | 'weekly') => {
    setGenerating(cadence);
    try {
      const created = await onGenerateReport(cadence);
      setSelectedId(created.id);
    } finally {
      setGenerating(null);
    }
  };

  const handleDownloadCsv = (report: ArbitrageReport) => {
    const csv = reportToCsv(report);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arbpulse-${report.cadence}-report-${report.periodLabel.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = (report: ArbitrageReport) => {
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arbpulse-${report.cadence}-report-${report.periodLabel.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Automated Daily &amp; Weekly Settlement Reports
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Scheduled automatic rollups run daily at 00:00 UTC and weekly on Mondays, or generate an on-demand snapshot below.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={generating !== null}
            onClick={() => void handleGenerate('daily')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-800 rounded-md hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            {generating === 'daily' ? 'Generating...' : 'Generate Daily Report'}
          </button>

          <button
            type="button"
            disabled={generating !== null}
            onClick={() => void handleGenerate('weekly')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-blue-700 text-white rounded-md hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            {generating === 'weekly' ? 'Generating...' : 'Generate Weekly Report'}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Archive List */}
        <section className="xl:col-span-4 bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Generated Reports ({reports.length})
          </h3>
          <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
            {reports.map((r) => {
              const selected = activeReport?.id === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left py-3 px-2.5 rounded-md transition-colors ${
                    selected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-700 capitalize">
                      {r.cadence} · {r.autoScheduled ? 'Auto-Scheduled' : 'On-Demand'}
                    </span>
                    <span className="font-mono tabular-nums">{r.periodLabel}</span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-900">
                    {r.title}
                  </div>
                  <div className="mt-1 text-[11px] font-mono tabular-nums text-slate-600">
                    Net {formatCurrency(r.netProfit, 0)} · ROAS {formatPct(r.blendedRoasPct)}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Detailed Report Reader */}
        <section className="xl:col-span-8 bg-white border border-slate-200 rounded-lg p-5">
          {!activeReport ? (
            <p className="text-sm text-slate-500">Select or generate a report to inspect.</p>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <div className="text-xs text-slate-500">
                    {activeReport.cadence === 'daily' ? 'Daily Digest' : 'Weekly Digest'} ·{' '}
                    {activeReport.periodLabel} · Generated {formatDateTime(activeReport.generatedAt)}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mt-1">
                    {activeReport.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownloadCsv(activeReport)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    Download CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadJson(activeReport)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    Export JSON
                  </button>
                </div>
              </div>

              {/* Executive KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-200 pb-4">
                <div>
                  <div className="text-xs text-slate-500">Total Spend</div>
                  <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
                    {formatCurrency(activeReport.totalSpend)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Gross Revenue</div>
                  <div className="text-lg font-semibold font-mono tabular-nums text-teal-700 mt-0.5">
                    {formatCurrency(activeReport.totalRevenue)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Net Profit</div>
                  <div className="text-lg font-semibold font-mono tabular-nums text-emerald-700 mt-0.5">
                    {formatCurrency(activeReport.netProfit)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Blended ROAS</div>
                  <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
                    {formatPct(activeReport.blendedRoasPct)}
                  </div>
                </div>
              </div>

              {/* Feeder Breakdown */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-2.5">
                  Feeder Settlement Breakdown
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                        <th className="py-2 pr-2">Feeder</th>
                        <th className="py-2 px-2 text-right">Clicks</th>
                        <th className="py-2 px-2 text-right">Spend</th>
                        <th className="py-2 px-2 text-right">Revenue</th>
                        <th className="py-2 px-2 text-right">Net Profit</th>
                        <th className="py-2 px-2 text-right">Margin</th>
                        <th className="py-2 pl-2 text-right">ROAS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {activeReport.feederBreakdown.map((f) => (
                        <tr key={f.feederId}>
                          <td className="py-2 pr-2 font-medium text-slate-900">{f.feederName}</td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-700">
                            {formatNumber(f.clicks)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-700">
                            {formatCurrency(f.spend)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-900">
                            {formatCurrency(f.revenue)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums font-medium text-emerald-700">
                            {formatCurrency(f.netProfit)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-700">
                            {formatPct(f.marginPct)}
                          </td>
                          <td className="py-2 pl-2 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {formatPct(f.roasPct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Keywords */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-2.5">
                  Top Contributing Keywords
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                        <th className="py-2 pr-2">Keyword</th>
                        <th className="py-2 px-2">Feeder · Network</th>
                        <th className="py-2 px-2 text-right">Spend</th>
                        <th className="py-2 px-2 text-right">Revenue</th>
                        <th className="py-2 px-2 text-right">Net Profit</th>
                        <th className="py-2 pl-2 text-right">ROAS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {activeReport.topKeywords.map((k, idx) => (
                        <tr key={`${k.keyword}-${idx}`}>
                          <td className="py-2 pr-2 font-medium text-slate-900">{k.keyword}</td>
                          <td className="py-2 px-2 text-slate-600">
                            {k.feederName} · {k.network}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-700">
                            {formatCurrency(k.spend)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-900">
                            {formatCurrency(k.revenue)}
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
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
