import { useState } from 'react';
import type { TimeSeriesPoint, TrendAnnotation, TrendAnnotationKind } from '../types/arbitrage';
import { formatCurrency, formatPct } from '../utils/format';

interface RevenueSpendChartProps {
  series: TimeSeriesPoint[];
  annotationsByIndex?: Record<number, TrendAnnotation[]>;
}

const KIND_PRIORITY: Record<TrendAnnotationKind, number> = {
  alert: 4,
  bid_decrease: 3,
  bid_increase: 2,
  campaign_event: 1,
};

function getPrimaryKind(annotations: TrendAnnotation[]): TrendAnnotationKind {
  let best = annotations[0].kind;
  for (const a of annotations) {
    if (KIND_PRIORITY[a.kind] > KIND_PRIORITY[best]) {
      best = a.kind;
    }
  }
  return best;
}

function getKindColor(kind: TrendAnnotationKind): {
  hex: string;
  textClass: string;
  label: string;
} {
  switch (kind) {
    case 'alert':
      return { hex: '#DC2626', textClass: 'text-red-700', label: 'Alert' };
    case 'bid_decrease':
      return { hex: '#D97706', textClass: 'text-amber-700', label: 'Bid Cut' };
    case 'bid_increase':
      return { hex: '#059669', textClass: 'text-emerald-700', label: 'Bid Scale' };
    case 'campaign_event':
      return { hex: '#1D4ED8', textClass: 'text-blue-700', label: 'API Sync' };
  }
}

export function RevenueSpendChart({
  series,
  annotationsByIndex = {},
}: RevenueSpendChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [pinnedTimestamp, setPinnedTimestamp] = useState<string | null>(null);

  if (series.length < 2) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-slate-500">
        Collecting live telemetry points...
      </div>
    );
  }

  const width = 820;
  const height = 250;
  const padLeft = 64;
  const padRight = 20;
  const padTop = 22;
  const padBottom = 30;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const allValues = series.flatMap((p) => [p.revenue, p.spend, p.netProfit]);
  const maxVal = Math.max(...allValues, 100) * 1.06;
  const minVal = Math.min(0, ...allValues);
  const range = Math.max(1, maxVal - minVal);

  const xFor = (i: number) => padLeft + (i / (series.length - 1)) * innerW;
  const yFor = (val: number) => padTop + innerH - ((val - minVal) / range) * innerH;

  const buildPath = (getter: (p: TimeSeriesPoint) => number) =>
    series
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(getter(p)).toFixed(1)}`)
      .join(' ');

  const revenuePath = buildPath((p) => p.revenue);
  const spendPath = buildPath((p) => p.spend);
  const profitPath = buildPath((p) => p.netProfit);

  const revenueArea = `${revenuePath} L ${xFor(series.length - 1).toFixed(1)} ${yFor(minVal).toFixed(1)} L ${xFor(0).toFixed(1)} ${yFor(minVal).toFixed(1)} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => minVal + range * t);

  const resolvedPinnedIdx =
    pinnedTimestamp !== null
      ? series.findIndex((p) => p.timestamp === pinnedTimestamp)
      : -1;
  const pinnedIdx = resolvedPinnedIdx >= 0 ? resolvedPinnedIdx : null;
  const inspectedIdx = hoverIdx ?? pinnedIdx;
  const activeIdx = inspectedIdx !== null && inspectedIdx < series.length ? inspectedIdx : series.length - 1;
  const activePoint = series[activeIdx];
  const activeAnnotations = annotationsByIndex[activeIdx] ?? [];
  const showPopover = inspectedIdx !== null && inspectedIdx < series.length;
  const popoverOnLeft = activeIdx > series.length * 0.52;
  const activeXPct = (xFor(activeIdx) / width) * 100;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-teal-600 inline-block" aria-hidden="true" />
            Gross Revenue
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-blue-600 inline-block" aria-hidden="true" />
            Ad Spend
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-slate-500 border-b border-dashed border-slate-500 inline-block" aria-hidden="true" />
            Net Profit
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <polygon points="5,1 9,5 5,9 1,5" fill="#059669" />
            </svg>
            Bid / Campaign Events
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono tabular-nums text-slate-700">
          <span>{activePoint.label}</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className="text-teal-700 font-medium">
            Rev {formatCurrency(activePoint.revenue, 0)}
          </span>
          <span className="text-blue-700 font-medium">
            Spend {formatCurrency(activePoint.spend, 0)}
          </span>
          <span className="text-slate-900 font-semibold">
            Net {formatCurrency(activePoint.netProfit, 0)} ({formatPct(activePoint.roasPct)})
          </span>
        </div>
      </div>

      <div
        className="relative w-full"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-60 select-none block"
          role="img"
          aria-label="Live Ad Spend, Gross Revenue, and Net Profit trend chart with campaign and bid event annotations"
        >
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0D9488" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#0D9488" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {yTicks.map((tick, idx) => {
            const y = yFor(tick);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-mono tabular-nums"
                >
                  ${Math.round(tick / 1000)}k
                </text>
              </g>
            );
          })}

          <path d={revenueArea} fill="url(#revGrad)" />
          <path d={revenuePath} fill="none" stroke="#0D9488" strokeWidth="2.2" />
          <path d={spendPath} fill="none" stroke="#1D4ED8" strokeWidth="2" />
          <path
            d={profitPath}
            fill="none"
            stroke="#64748B"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />

          {/* Vertical stems for annotated event points */}
          {series.map((p, i) => {
            const events = annotationsByIndex[i];
            if (!events || events.length === 0) return null;
            const kind = getPrimaryKind(events);
            const { hex } = getKindColor(kind);
            const cx = xFor(i);
            const cy = yFor(p.revenue);
            return (
              <line
                key={`stem-${p.timestamp}-${i}`}
                x1={cx}
                y1={cy}
                x2={cx}
                y2={height - padBottom}
                stroke={hex}
                strokeOpacity={activeIdx === i && showPopover ? 0.55 : 0.22}
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            );
          })}

          {showPopover && (
            <line
              x1={xFor(activeIdx)}
              y1={padTop}
              x2={xFor(activeIdx)}
              y2={height - padBottom}
              stroke="#64748B"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          <circle
            cx={xFor(activeIdx)}
            cy={yFor(activePoint.revenue)}
            r="4"
            fill="#0D9488"
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />
          <circle
            cx={xFor(activeIdx)}
            cy={yFor(activePoint.spend)}
            r="3.5"
            fill="#1D4ED8"
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />

          {series.map((p, i) => {
            const showLabel =
              i === 0 || i === Math.floor(series.length / 2) || i === series.length - 1;
            const slotWidth = innerW / series.length;
            return (
              <g key={`${p.timestamp}-${i}`}>
                {showLabel && (
                  <text
                    x={xFor(i)}
                    y={height - 8}
                    textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'}
                    className="fill-slate-400 text-[10px] font-mono tabular-nums"
                  >
                    {p.label}
                  </text>
                )}
                <rect
                  x={xFor(i) - slotWidth / 2}
                  y={padTop}
                  width={Math.max(8, slotWidth)}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                />
              </g>
            );
          })}
        </svg>

        {/* Accessible Interactive Event Annotation Markers */}
        {series.map((p, i) => {
          const events = annotationsByIndex[i];
          if (!events || events.length === 0) return null;
          const kind = getPrimaryKind(events);
          const { hex } = getKindColor(kind);
          const leftPct = (xFor(i) / width) * 100;
          const topPct = (yFor(p.revenue) / height) * 100;
          const isSelected = inspectedIdx === i;

          return (
            <button
              key={`marker-${p.timestamp}-${i}`}
              type="button"
              onMouseEnter={() => setHoverIdx(i)}
              onFocus={() => setHoverIdx(i)}
              onBlur={() => setHoverIdx(null)}
              onClick={() =>
                setPinnedTimestamp((prev) => (prev === p.timestamp ? null : p.timestamp))
              }
              aria-label={`Inspect ${events.length} event${events.length === 1 ? '' : 's'} at ${p.label}`}
              aria-pressed={pinnedTimestamp === p.timestamp}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer z-10"
            >
              <span
                className={`block w-2.5 h-2.5 rotate-45 border border-white transition-transform ${
                  isSelected ? 'scale-125' : 'hover:scale-125'
                }`}
                style={{ backgroundColor: hex }}
              />
            </button>
          );
        })}

        {/* Interactive Hover-Annotation Card */}
        {showPopover && (
          <div
            role="status"
            data-testid="chart-hover-annotation"
            style={{
              left: popoverOnLeft
                ? `max(8px, calc(${activeXPct}% - 304px))`
                : `min(calc(100% - 296px), calc(${activeXPct}% + 14px))`,
              top: '8px',
            }}
            className="absolute w-72 bg-white border border-slate-200 rounded-md shadow-md p-3 text-xs z-20 pointer-events-auto"
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {activePoint.label}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono tabular-nums text-slate-600">
                  ROAS {formatPct(activePoint.roasPct)}
                </span>
                {pinnedTimestamp === activePoint.timestamp && (
                  <button
                    type="button"
                    onClick={() => setPinnedTimestamp(null)}
                    className="text-[11px] font-medium text-blue-700 hover:underline"
                  >
                    Unpin
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 py-2 border-b border-slate-100 font-mono tabular-nums text-[11px]">
              <div>
                <div className="text-slate-400">Revenue</div>
                <div className="text-teal-700 font-medium">
                  {formatCurrency(activePoint.revenue, 0)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Spend</div>
                <div className="text-blue-700 font-medium">
                  {formatCurrency(activePoint.spend, 0)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Net</div>
                <div className="text-slate-900 font-semibold">
                  {formatCurrency(activePoint.netProfit, 0)}
                </div>
              </div>
            </div>

            <div className="pt-2">
              {activeAnnotations.length === 0 ? (
                <div className="text-[11px] text-slate-500">
                  No bid adjustments or campaign events at this timestamp.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] font-medium text-slate-500">
                    Campaign &amp; Bid Events ({activeAnnotations.length})
                  </div>
                  {activeAnnotations.slice(0, 3).map((ev) => {
                    const style = getKindColor(ev.kind);
                    return (
                      <div key={ev.id} className="text-[11px] leading-snug">
                        <div className="font-medium text-slate-900 flex items-center gap-1.5">
                          <span className={style.textClass}>{style.label}</span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="truncate">{ev.title}</span>
                        </div>
                        <div className="text-slate-600 mt-0.5 break-words">
                          {ev.detail}
                        </div>
                        <div className="text-slate-400 mt-0.5">{ev.meta}</div>
                      </div>
                    );
                  })}
                  {activeAnnotations.length > 3 && (
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                      +{activeAnnotations.length - 3} more events in this window
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
