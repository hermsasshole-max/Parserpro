import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Camera, Sparkles, ArrowRight } from 'lucide-react';
import type { SavedReceipt } from './types';
import { Navigation, type NavTab } from './components/Navigation';
import { MobileBottomNav } from './components/MobileBottomNav';
import { SafeAreaProvider, SafeAreaView } from './components/SafeAreaView';
import { AppProvider, useAppContext } from './context/AppContext';
import { FieldLoadingSkeleton } from './components/FieldLoadingSkeleton';
import { FieldDashboard } from './components/FieldDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

// Modals
import { AddReceiptModal } from './components/AddReceiptModal';
import { EditReceiptModal } from './components/EditReceiptModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { PrintableReportModal } from './components/PrintableReportModal';
import { BudgetLimitsModal } from './components/BudgetLimitsModal';
import { AndroidBackupModal } from './components/AndroidBackupModal';
import { OfflineOcrQueueModal } from './components/OfflineOcrQueueModal';
import { PaywallModal } from './components/PaywallModal';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { VoiceQuoteModal } from './components/VoiceQuoteModal';

// Utilities
import { subscribeToQueue } from './utils/offlineOcrQueue';
import { startBackgroundQueueWorker } from './utils/failSafeOcrCoordinator';
import { findDuplicateForReceipt } from './utils/duplicateDetection';
import { restorePlayPurchases, type UpgradeTriggerReason } from './utils/subscriptionManager';
import { getDisplayVersionInfo } from './constants/appVersion';

// ---------------------------------------------------------------------------
// 1. Production Code Splitting via React.lazy for Secondary View Modules
// ---------------------------------------------------------------------------
const QuotationEngine = React.lazy(() => import('./components/QuotationEngine'));
const InvoicingPipeline = React.lazy(() => import('./components/InvoicingPipeline'));
const ExpenseManager = React.lazy(() => import('./components/ExpenseManager'));
const FinancialAnalysis = React.lazy(() => import('./components/FinancialAnalysis'));
const ClientsDirectory = React.lazy(() => import('./components/ClientsDirectory'));
const InventoryManager = React.lazy(() => import('./components/InventoryManager'));
const SettingsManager = React.lazy(() => import('./components/SettingsManager'));
const SqlSchemaViewer = React.lazy(() => import('./components/SqlSchemaViewer'));

function AppContent() {
  const {
    receipts,
    persistReceipts,
    categoryBudgets,
    saveBudgets,
    subscriptionState,
    currencyCode,
    changeCurrency,
    darkMode,
    sunlightMode,
  } = useAppContext();

  // -------------------------------------------------------------------------
  // 2. Active Tab State with LocalStorage Field Persistence
  // -------------------------------------------------------------------------
  const [activeTab, setActiveTabState] = useState<NavTab>(() => {
    try {
      const saved = localStorage.getItem('parserpro_active_tab') as NavTab | null;
      if (saved) return saved;
    } catch {}
    return 'dashboard';
  });

  const setActiveTab = (tab: NavTab) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('parserpro_active_tab', tab);
    } catch {}
  };

  const [cameraLaunchTrigger, setCameraLaunchTrigger] = useState<number>(0);
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);

  // Modals
  const [isReceiptScannerModalOpen, setIsReceiptScannerModalOpen] = useState(false);
  const [isVoiceQuoteModalOpen, setIsVoiceQuoteModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<SavedReceipt | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [printableMonth, setPrintableMonth] = useState<string | null>(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isOfflineQueueOpen, setIsOfflineQueueOpen] = useState(false);
  const [upgradeModalState, setUpgradeModalState] = useState<{
    open: boolean;
    reason: UpgradeTriggerReason;
  }>({ open: false, reason: 'general' });

  // -------------------------------------------------------------------------
  // 3. Native Android Back Button Integration (@capacitor/app)
  // -------------------------------------------------------------------------
  useEffect(() => {
    let backListener: any = null;

    const setupBackButton = async () => {
      try {
        backListener = await CapApp.addListener('backButton', () => {
          // Priority 1: Gracefully close any active top-level modal
          if (isReceiptScannerModalOpen) {
            setIsReceiptScannerModalOpen(false);
            return;
          }
          if (isVoiceQuoteModalOpen) {
            setIsVoiceQuoteModalOpen(false);
            return;
          }
          if (isAddModalOpen) {
            setIsAddModalOpen(false);
            return;
          }
          if (editingReceipt) {
            setEditingReceipt(null);
            return;
          }
          if (isSearchOpen) {
            setIsSearchOpen(false);
            return;
          }
          if (printableMonth) {
            setPrintableMonth(null);
            return;
          }
          if (isBudgetModalOpen) {
            setIsBudgetModalOpen(false);
            return;
          }
          if (isBackupModalOpen) {
            setIsBackupModalOpen(false);
            return;
          }
          if (isOfflineQueueOpen) {
            setIsOfflineQueueOpen(false);
            return;
          }
          if (upgradeModalState.open) {
            setUpgradeModalState({ open: false, reason: 'general' });
            return;
          }

          // Priority 2: If inside a secondary view module, return to 'dashboard'
          if (activeTab !== 'dashboard') {
            setActiveTab('dashboard');
            return;
          }

          // Priority 3: On 'dashboard' with zero modals, minimize Android app safely
          CapApp.minimizeApp().catch(() => {});
        });
      } catch (err) {
        console.warn('[Capacitor BackButton] Native listener note:', err);
      }
    };

    setupBackButton();

    return () => {
      if (backListener && typeof backListener.remove === 'function') {
        backListener.remove();
      }
    };
  }, [
    isReceiptScannerModalOpen,
    isVoiceQuoteModalOpen,
    isAddModalOpen,
    editingReceipt,
    isSearchOpen,
    printableMonth,
    isBudgetModalOpen,
    isBackupModalOpen,
    isOfflineQueueOpen,
    upgradeModalState.open,
    activeTab,
  ]);

  // Subscribe to offline queue & start background retry worker
  useEffect(() => {
    const unsubQueue = subscribeToQueue((jobs) => {
      const active = jobs.filter(
        (j) =>
          j.status === 'pending' ||
          j.status === 'processing' ||
          j.status === 'fallback_extracted'
      ).length;
      setPendingOfflineCount(active);
    });

    const stopWorker = startBackgroundQueueWorker();

    return () => {
      unsubQueue();
      stopWorker();
    };
  }, []);

  // Global Cmd/Ctrl + K search shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Native Android Play Purchases restore on startup
  useEffect(() => {
    const isNative = Boolean(
      (window as any).Capacitor &&
        typeof (window as any).Capacitor.isNativePlatform === 'function' &&
        (window as any).Capacitor.isNativePlatform()
    );
    if (isNative) {
      restorePlayPurchases().catch(() => {});
    }
  }, []);

  const handleSaveSingleManualReceipt = (newReceipt: SavedReceipt) => {
    const dupe = findDuplicateForReceipt(newReceipt, receipts);
    if (dupe?.isBlocked) return;
    persistReceipts([newReceipt, ...receipts]);
  };

  const handleUpdateReceipt = (edited: SavedReceipt) => {
    persistReceipts(receipts.map((r) => (r.id === edited.id ? edited : r)));
  };

  const handleResetAllReceipts = () => {
    persistReceipts([]);
  };

  const openUpgradeModal = (reason: UpgradeTriggerReason = 'general') => {
    setUpgradeModalState({ open: true, reason });
  };

  const versionInfo = useMemo(() => getDisplayVersionInfo(), []);

  return (
    <SafeAreaView
      bottomOffsetClass="pb-28 sm:pb-16"
      className={`min-h-[100dvh] flex flex-col transition-colors duration-150 ${
        sunlightMode
          ? 'bg-amber-50/20 text-slate-950 contrast-125'
          : 'bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100'
      }`}
    >
      {/* Primary Sticky Field Header */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tier={subscriptionState.tier}
        onOpenUpgrade={openUpgradeModal}
        onOpenAddManual={() => setIsAddModalOpen(true)}
        onOpenVoiceQuote={() => setIsVoiceQuoteModalOpen(true)}
      />

      {/* Main Dynamic Viewport */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-28 sm:pb-16">
        <Suspense fallback={<FieldLoadingSkeleton title="Loading Field Module..." />}>
          {activeTab === 'dashboard' && (
            <FieldDashboard
              onNavigate={setActiveTab}
              onOpenReceiptScanModal={() => setIsReceiptScannerModalOpen(true)}
              onOpenVoiceQuoteModal={() => setIsVoiceQuoteModalOpen(true)}
              onOpenAddManual={() => setIsAddModalOpen(true)}
            />
          )}

          {activeTab === 'quotes' && (
            <QuotationEngine
              onOpenVoiceQuote={() => setIsVoiceQuoteModalOpen(true)}
              onOpenPaywall={() => openUpgradeModal('general')}
            />
          )}

          {activeTab === 'invoices' && <InvoicingPipeline />}

          {(activeTab === 'expenses' || activeTab === 'scanner' || activeTab === 'receipts') && (
            <ExpenseManager
              onOpenAddManual={() => setIsAddModalOpen(true)}
              onOpenSearch={() => setIsSearchOpen(true)}
              onOpenUpgrade={openUpgradeModal}
              onOpenPrintableReport={(m) => setPrintableMonth(m)}
              onEditReceipt={(r) => setEditingReceipt(r)}
              onOpenOfflineQueue={() => setIsOfflineQueueOpen(true)}
              pendingOfflineCount={pendingOfflineCount}
              cameraLaunchTrigger={cameraLaunchTrigger}
            />
          )}

          {activeTab === 'reports' && (
            <FinancialAnalysis
              onOpenBudgetModal={() => setIsBudgetModalOpen(true)}
              onOpenUpgrade={openUpgradeModal}
              onGoToScanner={() => setActiveTab('expenses')}
            />
          )}

          {activeTab === 'clients' && <ClientsDirectory />}

          {activeTab === 'inventory' && <InventoryManager />}

          {activeTab === 'settings' && (
            <SettingsManager
              onOpenUpgrade={openUpgradeModal}
              onOpenBudgetModal={() => setIsBudgetModalOpen(true)}
              onOpenBackupModal={() => setIsBackupModalOpen(true)}
              onOpenOfflineQueue={() => setIsOfflineQueueOpen(true)}
              onResetAllReceipts={handleResetAllReceipts}
              pendingOfflineCount={pendingOfflineCount}
            />
          )}

          {activeTab === 'schema' && <SqlSchemaViewer />}
        </Suspense>
      </main>

      {/* Mobile Bottom Navigation (Handles 100dvh safe-area insets without clipping) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        receiptCount={receipts.length}
      />

      {/* Modals & Dialogs */}
      <ReceiptScannerModal
        isOpen={isReceiptScannerModalOpen}
        onClose={() => setIsReceiptScannerModalOpen(false)}
        onOpenUpgrade={openUpgradeModal}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenAddManual={() => setIsAddModalOpen(true)}
        onOpenOfflineQueue={() => setIsOfflineQueueOpen(true)}
        pendingOfflineCount={pendingOfflineCount}
      />

      <VoiceQuoteModal
        isOpen={isVoiceQuoteModalOpen}
        onClose={() => setIsVoiceQuoteModalOpen(false)}
        onQuoteCreated={() => setActiveTab('quotes')}
      />

      <AddReceiptModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        existingReceipts={receipts}
        currencyCode={currencyCode}
        onSaveReceipt={handleSaveSingleManualReceipt}
      />

      <EditReceiptModal
        isOpen={Boolean(editingReceipt)}
        receipt={editingReceipt}
        existingReceipts={receipts}
        currencyCode={currencyCode}
        onClose={() => setEditingReceipt(null)}
        onUpdateReceipt={handleUpdateReceipt}
      />

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        receipts={receipts}
        currencyCode={currencyCode}
        onSelectReceipt={(rcpt) => {
          setActiveTab('expenses');
          setEditingReceipt(rcpt);
        }}
      />

      <PrintableReportModal
        isOpen={Boolean(printableMonth)}
        onClose={() => setPrintableMonth(null)}
        monthYear={printableMonth || new Date().toISOString().substring(0, 7)}
        receipts={receipts}
        currencyCode={currencyCode}
      />

      <BudgetLimitsModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        budgets={categoryBudgets}
        onSaveBudgets={saveBudgets}
        subscriptionState={subscriptionState}
        currencyCode={currencyCode}
        onOpenUpgrade={openUpgradeModal}
      />

      <AndroidBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        receipts={receipts}
        onRestoreReceipts={(restored) => persistReceipts(restored)}
        subscriptionState={subscriptionState}
        currencyCode={currencyCode}
        onOpenUpgrade={openUpgradeModal}
      />

      <OfflineOcrQueueModal
        isOpen={isOfflineQueueOpen}
        onClose={() => setIsOfflineQueueOpen(false)}
        existingReceipts={receipts}
        currencyCode={currencyCode}
        onSaveExtractedReceipts={(extracted) => persistReceipts([...extracted, ...receipts])}
      />

      <PaywallModal
        isOpen={upgradeModalState.open}
        onClose={() => setUpgradeModalState((prev) => ({ ...prev, open: false }))}
        reason={upgradeModalState.reason}
        currencyCode={currencyCode}
        subscriptionState={subscriptionState}
        onSubscriptionUpdated={() => {}}
      />
    </SafeAreaView>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <SafeAreaProvider>
          <AppContent />
        </SafeAreaProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
