import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Download,
  Pause,
  Play,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  AD_NETWORKS,
  calculateKeywordColumnFitWidth,
  DEFAULT_KEYWORD_COL_WIDTH,
  FEEDER_LIST,
  keywordsToCsv,
  MAX_KEYWORD_COL_WIDTH,
  MIN_KEYWORD_COL_WIDTH,
} from '../lib/arbitrageEngine';
import type { AdNetwork, FeederId, KeywordRecord, KeywordStatus } from '../types/arbitrage';
import { downloadTextFile } from '../utils/download';
import { formatCurrency, formatNumber, formatPct } from '../utils/format';

interface KeywordsViewProps {
  keywords: KeywordRecord[];
  initialFeeder?: FeederId | 'all';
  onUpdateKeyword: (id: string, patch: { cpcBid?: number; status?: KeywordStatus }) => Promise<void>;
}

type SortField =
  | 'index'
  | 'spend'
  | 'revenue'
  | 'netProfit'
  | 'roasPct'
  | 'marginPct'
  | 'cpcBid'
  | 'rpc'
  | 'clicks';

const ROW_HEIGHT = 44;
const VIEWPORT_HEIGHT = 572; // 13 visible rows at 44px
const COL_WIDTH_STORAGE_KEY = 'arbpulse_keyword_col_width_v1';

function loadSavedKeywordColWidth(): number {
  try {
    const raw = window.localStorage.getItem(COL_WIDTH_STORAGE_KEY);
    if (raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return Math.max(MIN_KEYWORD_COL_WIDTH, Math.min(MAX_KEYWORD_COL_WIDTH, Math.round(parsed)));
      }
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_KEYWORD_COL_WIDTH;
}

export function KeywordsView({
  keywords,
  initialFeeder = 'all',
  onUpdateKeyword,
}: KeywordsViewProps) {
  const [search, setSearch] = useState('');
  const [feederFilter, setFeederFilter] = useState<FeederId | 'all'>(initialFeeder);
  const [networkFilter, setNetworkFilter] = useState<AdNetwork | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<KeywordStatus | 'all'>('all');
  const [profitFilter, setProfitFilter] = useState<'all' | 'profitable' | 'loss'>('all');
  const [sortField, setSortField] = useState<SortField>('index');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [scrollTop, setScrollTop] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBidValue, setEditBidValue] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [keywordColWidth, setKeywordColWidth] = useState<number>(loadSavedKeywordColWidth);
  const [isResizingCol, setIsResizingCol] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(COL_WIDTH_STORAGE_KEY, String(keywordColWidth));
    } catch {
      // Ignore storage errors
    }
  }, [keywordColWidth]);

  const filteredKeywords = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = keywords.filter((k) => {
      if (feederFilter !== 'all' && k.feeder !== feederFilter) return false;
      if (networkFilter !== 'all' && k.network !== networkFilter) return false;
      if (statusFilter !== 'all' && k.status !== statusFilter) return false;
      if (profitFilter === 'profitable' && k.netProfit <= 0) return false;
      if (profitFilter === 'loss' && k.netProfit >= 0) return false;
      if (
        q &&
        !k.keyword.toLowerCase().includes(q) &&
        !k.vertical.toLowerCase().includes(q) &&
        !k.campaignName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    list.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    return list;
  }, [
    keywords,
    search,
    feederFilter,
    networkFilter,
    statusFilter,
    profitFilter,
    sortField,
    sortDir,
  ]);

  const filteredTotals = useMemo(() => {
    let spend = 0;
    let revenue = 0;
    let clicks = 0;
    for (const k of filteredKeywords) {
      spend += k.spend;
      revenue += k.revenue;
      clicks += k.clicks;
    }
    const netProfit = revenue - spend;
    const roas = spend > 0 ? (revenue / spend) * 100 : 0;
    return { spend, revenue, netProfit, roas, clicks };
  }, [filteredKeywords]);

  const totalHeight = filteredKeywords.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 4);
  const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + 8;
  const endIndex = Math.min(filteredKeywords.length, startIndex + visibleCount);
  const visibleRows = filteredKeywords.slice(startIndex, endIndex);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'index' ? 'asc' : 'desc');
    }
  };

  const handleStepBid = async (kw: KeywordRecord, deltaPct: number) => {
    setSavingId(kw.id);
    try {
      const nextBid = Math.max(0.05, Number((kw.cpcBid * (1 + deltaPct)).toFixed(3)));
      await onUpdateKeyword(kw.id, { cpcBid: nextBid });
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveCustomBid = async (kw: KeywordRecord) => {
    const parsed = Number(editBidValue);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setSavingId(kw.id);
    try {
      await onUpdateKeyword(kw.id, { cpcBid: parsed });
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  };

  const handleTogglePause = async (kw: KeywordRecord) => {
    setSavingId(kw.id);
    try {
      const nextStatus: KeywordStatus = kw.status === 'paused' ? 'active' : 'paused';
      await onUpdateKeyword(kw.id, { status: nextStatus });
    } finally {
      setSavingId(null);
    }
  };

  const handleAutoFitKeywordColumn = useCallback(() => {
    const source = filteredKeywords.length > 0 ? filteredKeywords : keywords;
    let measureFn: ((text: string) => number) | undefined;
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = '500 12px "DM Sans", system-ui, sans-serif';
        measureFn = (text: string) => ctx.measureText(text).width;
      }
    } catch {
      // Fallback to deterministic estimate
    }
    const fitWidth = calculateKeywordColumnFitWidth(source, measureFn);
    setKeywordColWidth(fitWidth);
  }, [filteredKeywords, keywords]);

  const handleResetKeywordColumn = useCallback(() => {
    setKeywordColWidth(DEFAULT_KEYWORD_COL_WIDTH);
  }, []);

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragStateRef.current = { startX: e.clientX, startWidth: keywordColWidth };
    setIsResizingCol(true);
  };

  useEffect(() => {
    if (!isResizingCol) return;

    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const nextWidth = Math.max(
        MIN_KEYWORD_COL_WIDTH,
        Math.min(MAX_KEYWORD_COL_WIDTH, Math.round(drag.startWidth + (e.clientX - drag.startX)))
      );
      setKeywordColWidth(nextWidth);
    };

    const onPointerUp = () => {
      dragStateRef.current = null;
      setIsResizingCol(false);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isResizingCol]);

  const gridTemplateColumns = `42px ${keywordColWidth}px 82px 84px 68px 120px 62px 58px 74px 76px 78px 64px minmax(66px, 1fr)`;

  const handleExportCsv = () => {
    const csv = keywordsToCsv(filteredKeywords);
    const suffix = feederFilter === 'all' ? 'filtered' : feederFilter;
    downloadTextFile(csv, `arbpulse-keywords-${suffix}.csv`, 'text/csv;charset=utf-8;');
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 inline ml-0.5" aria-hidden="true" />
    ) : (
      <ArrowDown className="w-3 h-3 inline ml-0.5" aria-hidden="true" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar & Filters */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Live Keyword Arbitrage Matrix
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums" data-testid="keyword-count-summary">
              Showing {formatNumber(filteredKeywords.length)} of {formatNumber(keywords.length)} live keywords
              {' · '}Spend {formatCurrency(filteredTotals.spend, 0)}
              {' · '}Revenue {formatCurrency(filteredTotals.revenue, 0)}
              {' · '}Net {formatCurrency(filteredTotals.netProfit, 0)} ({formatPct(filteredTotals.roas)})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAutoFitKeywordColumn}
              title="Auto-fit Keyword column width to display full keyword text (or double-click column border)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
              Fit Keywords
            </button>

            {keywordColWidth !== DEFAULT_KEYWORD_COL_WIDTH && (
              <button
                type="button"
                onClick={handleResetKeywordColumn}
                title="Reset Keyword column width to default"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 font-mono tabular-nums"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Reset ({keywordColWidth}px)
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Export Filtered CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <div className="md:col-span-4 relative">
            <label htmlFor="kw-search" className="sr-only">
              Search 1,000 keywords
            </label>
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="kw-search"
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (scrollRef.current) scrollRef.current.scrollTop = 0;
              }}
              placeholder="Search keyword, vertical, or campaign..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="kw-feeder-filter" className="sr-only">
              Filter by Feeder
            </label>
            <select
              id="kw-feeder-filter"
              value={feederFilter}
              onChange={(e) => {
                setFeederFilter(e.target.value as FeederId | 'all');
                if (scrollRef.current) scrollRef.current.scrollTop = 0;
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All 5 Feeders</option>
              {FEEDER_LIST.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="kw-network-filter" className="sr-only">
              Filter by Ad Network
            </label>
            <select
              id="kw-network-filter"
              value={networkFilter}
              onChange={(e) => {
                setNetworkFilter(e.target.value as AdNetwork | 'all');
                if (scrollRef.current) scrollRef.current.scrollTop = 0;
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All Ad Networks</option>
              {AD_NETWORKS.map((net) => (
                <option key={net} value={net}>
                  {net}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="kw-status-filter" className="sr-only">
              Filter by Status
            </label>
            <select
              id="kw-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as KeywordStatus | 'all')}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="scaling">Scaling</option>
              <option value="throttled">Throttled</option>
              <option value="paused">Paused</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="kw-profit-filter" className="sr-only">
              Filter by Profitability
            </label>
            <select
              id="kw-profit-filter"
              value={profitFilter}
              onChange={(e) =>
                setProfitFilter(e.target.value as 'all' | 'profitable' | 'loss')
              }
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All Margins</option>
              <option value="profitable">Profitable Only</option>
              <option value="loss">Loss-Making Only</option>
            </select>
          </div>
        </div>
      </section>

      {/* Virtualized 1,000-Row Live Grid */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${898 + keywordColWidth}px` }} data-testid="keywords-sheet-grid">
            {/* Sticky Header Row */}
            <div
              role="row"
              style={{ gridTemplateColumns }}
              className="grid items-center px-3 py-2.5 bg-slate-50 border-b border-slate-200 text-[11px] font-medium text-slate-500"
            >
              <button
                type="button"
                onClick={() => handleSort('index')}
                className="text-left hover:text-slate-900"
              >
                # {renderSortIcon('index')}
              </button>
              <div className="relative flex items-center justify-between pr-3 min-w-0">
                <span className="truncate">Keyword · Vertical · Geo</span>
                <div
                  role="separator"
                  tabIndex={0}
                  aria-orientation="vertical"
                  aria-label="Resize keyword column width"
                  aria-valuemin={MIN_KEYWORD_COL_WIDTH}
                  aria-valuemax={MAX_KEYWORD_COL_WIDTH}
                  aria-valuenow={keywordColWidth}
                  title="Drag to resize Keyword column or double-click to auto-fit"
                  onPointerDown={handleResizePointerDown}
                  onDoubleClick={handleAutoFitKeywordColumn}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      setKeywordColWidth((w) => Math.min(MAX_KEYWORD_COL_WIDTH, w + 16));
                    } else if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      setKeywordColWidth((w) => Math.max(MIN_KEYWORD_COL_WIDTH, w - 16));
                    } else if (e.key === 'Home') {
                      e.preventDefault();
                      handleResetKeywordColumn();
                    } else if (e.key === 'End' || e.key === 'Enter') {
                      e.preventDefault();
                      handleAutoFitKeywordColumn();
                    }
                  }}
                  className="absolute right-0.5 -top-2.5 -bottom-2.5 w-3 cursor-col-resize touch-none flex items-center justify-center group focus:outline-none"
                >
                  <span
                    className={`h-5 w-[2px] rounded-full transition-colors ${
                      isResizingCol
                        ? 'bg-blue-600'
                        : 'bg-slate-300 group-hover:bg-blue-500 group-focus:bg-blue-600'
                    }`}
                  />
                </div>
              </div>
              <div className="pl-1">Feeder</div>
              <div>Network</div>
              <div>Status</div>
              <button
                type="button"
                onClick={() => handleSort('cpcBid')}
                className="text-right hover:text-slate-900 pr-2"
              >
                CPC Bid {renderSortIcon('cpcBid')}
              </button>
              <button
                type="button"
                onClick={() => handleSort('rpc')}
                className="text-right hover:text-slate-900"
              >
                RPC {renderSortIcon('rpc')}
              </button>
              <button
                type="button"
                onClick={() => handleSort('clicks')}
                className="text-right hover:text-slate-900"
              >
                Clicks {renderSortIcon('clicks')}
              </button>
              <button
                type="button"
                onClick={() => handleSort('spend')}
                className="text-right hover:text-slate-900"
              >
                Spend {renderSortIcon('spend')}
              </button>
              <button
                type="button"
                onClick={() => handleSort('revenue')}
                className="text-right hover:text-slate-900"
              >
                Revenue {renderSortIcon('revenue')}
              </button>
              <button
                type="button"
                onClick={() => handleSort('netProfit')}
                className="text-right hover:text-slate-900"
              >
                Profit {renderSortIcon('netProfit')}
              </button>
              <button
                type="button"
                onClick={() => handleSort('roasPct')}
                className="text-right hover:text-slate-900"
              >
                ROAS {renderSortIcon('roasPct')}
              </button>
              <div className="text-right">Control</div>
            </div>

            {filteredKeywords.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">
                No keywords match your active filter criteria.
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setFeederFilter('all');
                      setNetworkFilter('all');
                      setStatusFilter('all');
                      setProfitFilter('all');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 rounded hover:bg-blue-50"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            ) : (
              <div
                ref={scrollRef}
                data-testid="keywords-virtual-scroll"
                onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
                style={{ height: `${VIEWPORT_HEIGHT}px` }}
                className="overflow-y-auto relative divide-y divide-slate-100"
              >
                <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
                  {visibleRows.map((kw, offsetIdx) => {
                    const rowTop = (startIndex + offsetIdx) * ROW_HEIGHT;
                    const isEditing = editingId === kw.id;
                    const isSaving = savingId === kw.id;

                    return (
                      <div
                        key={kw.id}
                        role="row"
                        style={{
                          position: 'absolute',
                          top: `${rowTop}px`,
                          left: 0,
                          right: 0,
                          height: `${ROW_HEIGHT}px`,
                          gridTemplateColumns,
                        }}
                        className="grid items-center px-3 text-xs border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <div className="font-mono tabular-nums text-slate-400">
                          {kw.index}
                        </div>
                        <div
                          className={`min-w-0 pr-3 h-full flex flex-col justify-center ${
                            isResizingCol ? 'border-r border-blue-200' : 'border-r border-slate-100'
                          }`}
                        >
                          <div className="font-medium text-slate-900 truncate" title={kw.keyword}>
                            {kw.keyword}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {kw.vertical} · {kw.geo}
                          </div>
                        </div>
                        <div className="pl-1 text-slate-700 font-medium truncate">
                          {kw.feederName}
                        </div>
                        <div className="text-slate-600 truncate">{kw.network}</div>
                        <div
                          className={`font-medium capitalize ${
                            kw.status === 'scaling'
                              ? 'text-emerald-700'
                              : kw.status === 'active'
                                ? 'text-slate-700'
                                : kw.status === 'throttled'
                                  ? 'text-amber-700'
                                  : 'text-slate-400'
                          }`}
                        >
                          {kw.status}
                        </div>

                        {/* Inline CPC Bid Editor */}
                        <div className="flex items-center justify-end gap-1 pr-2 font-mono tabular-nums">
                          {isEditing ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                void handleSaveCustomBid(kw);
                              }}
                              className="flex items-center gap-1"
                            >
                              <input
                                type="number"
                                step="0.005"
                                min="0.05"
                                aria-label={`Edit CPC bid for ${kw.keyword}`}
                                value={editBidValue}
                                onChange={(e) => setEditBidValue(e.target.value)}
                                className="w-16 px-1 py-0.5 text-xs border border-blue-500 rounded text-right bg-white"
                                autoFocus
                              />
                              <button
                                type="submit"
                                disabled={isSaving}
                                className="px-1.5 py-0.5 text-[11px] font-sans font-medium bg-blue-700 text-white rounded hover:bg-blue-800"
                              >
                                Save
                              </button>
                            </form>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={isSaving}
                                aria-label={`Decrease bid 5% for ${kw.keyword}`}
                                onClick={() => void handleStepBid(kw, -0.05)}
                                className="px-1 text-slate-400 hover:text-slate-900 border border-slate-200 rounded text-[11px]"
                              >
                                -
                              </button>
                              <button
                                type="button"
                                aria-label={`Set custom bid for ${kw.keyword}`}
                                onClick={() => {
                                  setEditingId(kw.id);
                                  setEditBidValue(kw.cpcBid.toFixed(3));
                                }}
                                className="text-slate-900 hover:text-blue-700 underline decoration-dotted underline-offset-2"
                              >
                                {formatCurrency(kw.cpcBid, 3)}
                              </button>
                              <button
                                type="button"
                                disabled={isSaving}
                                aria-label={`Increase bid 5% for ${kw.keyword}`}
                                onClick={() => void handleStepBid(kw, 0.05)}
                                className="px-1 text-slate-400 hover:text-slate-900 border border-slate-200 rounded text-[11px]"
                              >
                                +
                              </button>
                            </>
                          )}
                        </div>

                        <div className="text-right font-mono tabular-nums text-slate-600">
                          {formatCurrency(kw.rpc, 3)}
                        </div>
                        <div className="text-right font-mono tabular-nums text-slate-700">
                          {formatNumber(kw.clicks)}
                        </div>
                        <div className="text-right font-mono tabular-nums text-slate-700">
                          {formatCurrency(kw.spend)}
                        </div>
                        <div className="text-right font-mono tabular-nums text-slate-900">
                          {formatCurrency(kw.revenue)}
                        </div>
                        <div
                          className={`text-right font-mono tabular-nums font-medium ${
                            kw.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(kw.netProfit)}
                        </div>
                        <div
                          className={`text-right font-mono tabular-nums font-semibold ${
                            kw.roasPct >= 100 ? 'text-slate-900' : 'text-red-600'
                          }`}
                        >
                          {formatPct(kw.roasPct)}
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => void handleTogglePause(kw)}
                            aria-label={
                              kw.status === 'paused'
                                ? `Resume ${kw.keyword}`
                                : `Pause ${kw.keyword}`
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border border-slate-200 rounded text-slate-700 hover:bg-slate-100"
                          >
                            {kw.status === 'paused' ? (
                              <>
                                <Play className="w-3 h-3" aria-hidden="true" />
                                Run
                              </>
                            ) : (
                              <>
                                <Pause className="w-3 h-3" aria-hidden="true" />
                                Pause
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
