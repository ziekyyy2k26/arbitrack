import { useState } from 'react';
import {
  Activity,
  BarChart3,
  BellRing,
  FileSpreadsheet,
  KeyRound,
  Menu,
  Pause,
  Play,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useArbitrageWorkspace } from './hooks/useArbitrageWorkspace';
import type { FeederId } from './types/arbitrage';
import { formatNumber } from './utils/format';
import { OverviewView } from './components/OverviewView';
import { KeywordsView } from './components/KeywordsView';
import { AutoBiddingView } from './components/AutoBiddingView';
import { BenchmarksAlertsView } from './components/BenchmarksAlertsView';
import { IntegrationsView } from './components/IntegrationsView';
import { ReportsView } from './components/ReportsView';

type ActiveView =
  | 'overview'
  | 'keywords'
  | 'bidding'
  | 'benchmarks'
  | 'integrations'
  | 'reports';

const NAV_ITEMS: Array<{
  id: ActiveView;
  label: string;
  icon: typeof Activity;
}> = [
  { id: 'overview', label: 'Live Overview', icon: Activity },
  { id: 'keywords', label: 'Live 1,000 Keywords', icon: KeyRound },
  { id: 'bidding', label: 'Auto-Bidding Rules', icon: SlidersHorizontal },
  { id: 'benchmarks', label: 'Benchmarks & Alerts', icon: BellRing },
  { id: 'integrations', label: 'Feeders & API Sync', icon: BarChart3 },
  { id: 'reports', label: 'Auto Reports', icon: FileSpreadsheet },
];

export default function App() {
  const {
    state,
    loading,
    error,
    wsStatus,
    streamPaused,
    setStreamPaused,
    refreshState,
    updateKeyword,
    toggleAutoBidding,
    createBidRule,
    toggleBidRule,
    deleteBidRule,
    executeBidRules,
    createAlertThreshold,
    toggleAlertThreshold,
    deleteAlertThreshold,
    acknowledgeAlert,
    syncIntegration,
    updateIntegration,
    generateReport,
  } = useArbitrageWorkspace();

  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [keywordsInitialFeeder, setKeywordsInitialFeeder] = useState<FeederId | 'all'>('all');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const openAlertsCount = state ? state.alerts.filter((a) => !a.acknowledged).length : 0;

  const navigateTo = (view: ActiveView) => {
    setActiveView(view);
    setMobileNavOpen(false);
  };

  const handleNavigateKeywords = (feeder: FeederId | 'all' = 'all') => {
    setKeywordsInitialFeeder(feeder);
    setActiveView('keywords');
  };

  const currentTitle =
    NAV_ITEMS.find((item) => item.id === activeView)?.label ?? 'Live Overview';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 bg-white border-r border-slate-200">
        <div className="h-14 px-5 flex items-center border-b border-slate-200">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            ArbPulse
          </span>
        </div>

        <nav aria-label="Primary navigation" className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'benchmarks' && openAlertsCount > 0 && (
                  <span
                    className={`font-mono tabular-nums text-[11px] ${
                      active ? 'text-amber-300' : 'text-amber-700'
                    }`}
                  >
                    {openAlertsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
          <div className="font-medium text-slate-700">Connected Feeders</div>
          <div>Media.net · Tonic · System1</div>
          <div>Meta · Yahoo</div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-full bg-white h-full border-r border-slate-200 flex flex-col z-50">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200">
              <span className="font-display text-lg font-bold tracking-tight text-slate-900">
                ArbPulse
              </span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileNavOpen(false)}
                className="p-2 text-slate-600 hover:text-slate-900"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Mobile navigation" className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium rounded-md ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <h1 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
              {currentTitle}
            </h1>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {state && (
              <div className="hidden sm:flex items-center gap-2 text-xs font-mono tabular-nums text-slate-500">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    streamPaused
                      ? 'bg-amber-500'
                      : wsStatus === 'live'
                        ? 'bg-emerald-600'
                        : 'bg-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <span>
                  {streamPaused
                    ? 'Stream Paused'
                    : wsStatus === 'live'
                      ? `Live Stream · Tick #${formatNumber(state.summary.tickCount)}`
                      : 'Reconnecting...'}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setStreamPaused((p) => !p)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              {streamPaused ? (
                <>
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  Resume Feed
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                  Pause Feed
                </>
              )}
            </button>
          </div>
        </header>

        {/* Workspace Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {loading ? (
            <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
              <div className="h-28 bg-white border border-slate-200 rounded-lg animate-pulse" />
              <div className="h-72 bg-white border border-slate-200 rounded-lg animate-pulse" />
            </div>
          ) : error || !state ? (
            <div className="bg-white border border-red-200 rounded-lg p-6 text-sm text-red-700">
              <p className="font-semibold">Unable to load arbitrage workspace</p>
              <p className="mt-1 text-xs text-red-600">{error ?? 'Unknown error'}</p>
              <button
                type="button"
                onClick={() => void refreshState()}
                className="mt-3 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry Connection
              </button>
            </div>
          ) : (
            <>
              {activeView === 'overview' && (
                <OverviewView
                  summary={state.summary}
                  trendSeries={state.trendSeries}
                  keywords={state.keywords}
                  bidAuditLog={state.bidAuditLog}
                  alerts={state.alerts}
                  syncLogs={state.syncLogs}
                  onNavigateKeywords={handleNavigateKeywords}
                  onNavigateView={(v) => navigateTo(v)}
                  onAcknowledgeAlert={acknowledgeAlert}
                />
              )}

              {activeView === 'keywords' && (
                <KeywordsView
                  key={keywordsInitialFeeder}
                  keywords={state.keywords}
                  initialFeeder={keywordsInitialFeeder}
                  onUpdateKeyword={updateKeyword}
                />
              )}

              {activeView === 'bidding' && (
                <AutoBiddingView
                  autoBiddingEnabled={state.autoBiddingEnabled}
                  bidRules={state.bidRules}
                  bidAuditLog={state.bidAuditLog}
                  onToggleAutoBidding={toggleAutoBidding}
                  onCreateRule={createBidRule}
                  onToggleRule={toggleBidRule}
                  onDeleteRule={deleteBidRule}
                  onExecuteRules={executeBidRules}
                />
              )}

              {activeView === 'benchmarks' && (
                <BenchmarksAlertsView
                  benchmarks={state.benchmarks}
                  alertThresholds={state.alertThresholds}
                  alerts={state.alerts}
                  onCreateThreshold={createAlertThreshold}
                  onToggleThreshold={toggleAlertThreshold}
                  onDeleteThreshold={deleteAlertThreshold}
                  onAcknowledgeAlert={acknowledgeAlert}
                />
              )}

              {activeView === 'integrations' && (
                <IntegrationsView
                  integrations={state.integrations}
                  syncLogs={state.syncLogs}
                  onSyncNow={syncIntegration}
                  onUpdateIntegration={updateIntegration}
                />
              )}

              {activeView === 'reports' && (
                <ReportsView
                  reports={state.reports}
                  onGenerateReport={generateReport}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
