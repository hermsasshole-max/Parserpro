import React, { useState, useEffect, useMemo } from 'react';
import { Camera, ArrowRight } from 'lucide-react';
import type { CategoryBudgets, SavedReceipt } from './types';
import { Navigation, type NavTab } from './components/Navigation';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ReceiptScanner } from './components/ReceiptScanner';
import { MonthlyReceiptsList } from './components/MonthlyReceiptsList';
import { MonthToMonthReport } from './components/MonthToMonthReport';
import { SettingsView } from './components/SettingsView';
import { AddReceiptModal } from './components/AddReceiptModal';
import { EditReceiptModal } from './components/EditReceiptModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { PrintableReportModal } from './components/PrintableReportModal';
import { BudgetLimitsModal } from './components/BudgetLimitsModal';
import { AndroidBackupModal } from './components/AndroidBackupModal';
import { OfflineOcrQueueModal } from './components/OfflineOcrQueueModal';
import { UpgradeProModal } from './components/UpgradeProModal';
import {
  loadReceiptsFromDevice,
  saveReceiptsToDevice,
  requestPersistentDeviceStorage,
  stripLegacyDemoReceipts,
} from './utils/deviceStorage';
import {
  loadCategoryBudgets,
  saveCategoryBudgets,
} from './utils/budgetStorage';
import {
  getSubscriptionState,
  subscribeToSubscriptionChanges,
  type SubscriptionState,
  type UpgradeTriggerReason,
} from './utils/subscriptionManager';
import { getPreferredCurrency } from './utils/currencyFormat';
import { subscribeToQueue } from './utils/offlineOcrQueue';
import { startBackgroundQueueWorker } from './utils/failSafeOcrCoordinator';
import { findDuplicateForReceipt } from './utils/duplicateDetection';

function getCurrentMonthIso(): string {
  return new Date().toISOString().substring(0, 7);
}

function getPreviousMonthIso(monthIso: string): string {
  const [y, m] = monthIso.split('-').map(Number);
  const d = new Date(y, (m || 1) - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('scanner');
  const [cameraLaunchTrigger, setCameraLaunchTrigger] = useState<number>(0);
  const [receipts, setReceipts] = useState<SavedReceipt[]>(() => {
    try {
      const raw = localStorage.getItem('parserpro_saved_receipts_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return stripLegacyDemoReceipts(parsed);
        }
      }
    } catch {}
    return [];
  });

  const currentMonth = useMemo(() => getCurrentMonthIso(), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [comparisonMonth, setComparisonMonth] = useState<string>(() =>
    getPreviousMonthIso(currentMonth)
  );

  const [currencyCode, setCurrencyCode] = useState<string>(() => getPreferredCurrency());
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>(() =>
    getSubscriptionState()
  );
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudgets>(() =>
    loadCategoryBudgets()
  );
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('parserpro_dark_mode') === 'true';
    } catch {
      return false;
    }
  });

  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);

  // Modals
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

  // Apply Dark Mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('parserpro_dark_mode', String(darkMode));
    } catch {}
  }, [darkMode]);

  // Hydrate persistent receipts from IndexedDB & request OS storage persistence
  useEffect(() => {
    requestPersistentDeviceStorage().catch(() => {});

    loadReceiptsFromDevice().then((stored) => {
      const cleaned = stripLegacyDemoReceipts(stored);
      if (cleaned.length !== stored.length) {
        saveReceiptsToDevice(cleaned).catch(() => {});
      }
      setReceipts(cleaned);
      if (cleaned.length > 0) {
        const months = Array.from(new Set(cleaned.map((r) => r.month_year))).sort((a, b) =>
          b.localeCompare(a)
        );
        if (months[0]) {
          setSelectedMonth(months[0]);
          setComparisonMonth(months[1] || getPreviousMonthIso(months[0]));
        }
      }
    });
  }, []);

  // Subscribe to subscription state & currency updates
  useEffect(() => {
    const unsubSub = subscribeToSubscriptionChanges((nextState) => {
      setSubscriptionState(nextState);
    });

    const handleCurrencyChanged = () => {
      setCurrencyCode(getPreferredCurrency());
    };
    window.addEventListener('parserpro-currency-changed', handleCurrencyChanged);

    return () => {
      unsubSub();
      window.removeEventListener('parserpro-currency-changed', handleCurrencyChanged);
    };
  }, []);

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

  const availableMonths = useMemo(() => {
    const set = new Set<string>([
      currentMonth,
      getPreviousMonthIso(currentMonth),
      ...receipts.map((r) => r.month_year).filter(Boolean),
    ]);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [receipts, currentMonth]);

  const persistReceipts = (updated: SavedReceipt[]) => {
    setReceipts(updated);
    saveReceiptsToDevice(updated).catch((err) =>
      console.error('Failed to persist receipts:', err)
    );
  };

  const handleSaveBatchReceipts = (newReceipts: SavedReceipt[]) => {
    if (!newReceipts.length) return;
    const acceptedUnique: SavedReceipt[] = [];
    for (const candidate of newReceipts) {
      const dupe = findDuplicateForReceipt(candidate, receipts, acceptedUnique);
      if (!dupe?.isBlocked) {
        acceptedUnique.push(candidate);
      }
    }
    if (acceptedUnique.length === 0) return;

    const updated = [...acceptedUnique, ...receipts];
    persistReceipts(updated);
    const newestMonth = acceptedUnique[0]?.month_year;
    if (newestMonth) {
      setSelectedMonth(newestMonth);
    }
  };

  const handleSaveSingleManualReceipt = (newReceipt: SavedReceipt) => {
    const dupe = findDuplicateForReceipt(newReceipt, receipts);
    if (dupe?.isBlocked) return;
    const updated = [newReceipt, ...receipts];
    persistReceipts(updated);
    setSelectedMonth(newReceipt.month_year);
  };

  const handleUpdateReceipt = (edited: SavedReceipt) => {
    const updated = receipts.map((r) => (r.id === edited.id ? edited : r));
    persistReceipts(updated);
  };

  const handleDeleteReceipt = (id: string) => {
    const updated = receipts.filter((r) => r.id !== id);
    persistReceipts(updated);
  };

  const handleResetAllReceipts = () => {
    persistReceipts([]);
  };

  const handleSaveBudgets = (nextBudgets: CategoryBudgets) => {
    setCategoryBudgets(nextBudgets);
    saveCategoryBudgets(nextBudgets);
  };

  const openUpgradeModal = (reason: UpgradeTriggerReason = 'general') => {
    setUpgradeModalState({ open: true, reason });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tier={subscriptionState.tier}
        onOpenUpgrade={openUpgradeModal}
        onOpenAddManual={() => setIsAddModalOpen(true)}
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-8 pb-32 sm:pb-12">
        {receipts.length === 0 && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('scanner');
              setCameraLaunchTrigger((n) => n + 1);
            }}
            className="w-full mb-5 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/70 px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-emerald-100/70 dark:hover:bg-emerald-950/55 active:scale-[0.99] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  Scan your first receipt
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                  Tap here to snap a slip and start your personal ledger
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap shrink-0">
              <span>Start</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </button>
        )}

        {activeTab === 'scanner' && (
          <ReceiptScanner
            existingReceipts={receipts}
            subscriptionState={subscriptionState}
            currencyCode={currencyCode}
            pendingOfflineCount={pendingOfflineCount}
            cameraLaunchTrigger={cameraLaunchTrigger}
            onSaveReceipts={handleSaveBatchReceipts}
            onOpenUpgrade={openUpgradeModal}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenAddManual={() => setIsAddModalOpen(true)}
            onOpenOfflineQueue={() => setIsOfflineQueueOpen(true)}
          />
        )}

        {activeTab === 'receipts' && (
          <MonthlyReceiptsList
            receipts={receipts}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
            availableMonths={availableMonths}
            currencyCode={currencyCode}
            subscriptionState={subscriptionState}
            onOpenUpgrade={openUpgradeModal}
            onDeleteReceipt={handleDeleteReceipt}
            onEditReceipt={(r) => setEditingReceipt(r)}
            onOpenAddManual={() => setIsAddModalOpen(true)}
            onOpenSearch={() => setIsSearchOpen(true)}
            onGoToScanner={() => setActiveTab('scanner')}
            onOpenPrintableReport={(m) => setPrintableMonth(m)}
          />
        )}

        {activeTab === 'reports' && (
          <MonthToMonthReport
            receipts={receipts}
            selectedMonth={selectedMonth}
            comparisonMonth={comparisonMonth}
            availableMonths={availableMonths}
            onSelectMonth={setSelectedMonth}
            onSelectComparisonMonth={setComparisonMonth}
            categoryBudgets={categoryBudgets}
            onOpenBudgetModal={() => setIsBudgetModalOpen(true)}
            subscriptionState={subscriptionState}
            currencyCode={currencyCode}
            onOpenUpgrade={openUpgradeModal}
            onGoToScanner={() => setActiveTab('scanner')}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            receipts={receipts}
            subscriptionState={subscriptionState}
            currencyCode={currencyCode}
            onCurrencyChange={setCurrencyCode}
            darkMode={darkMode}
            onToggleDarkMode={setDarkMode}
            pendingOfflineCount={pendingOfflineCount}
            onOpenUpgrade={openUpgradeModal}
            onOpenBudgetModal={() => setIsBudgetModalOpen(true)}
            onOpenBackupModal={() => setIsBackupModalOpen(true)}
            onOpenOfflineQueue={() => setIsOfflineQueueOpen(true)}
            onResetAllReceipts={handleResetAllReceipts}
          />
        )}
      </main>

      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        receiptCount={receipts.length}
      />

      {/* Modals */}
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
          setSelectedMonth(rcpt.month_year);
          setActiveTab('receipts');
          setEditingReceipt(rcpt);
        }}
      />

      <PrintableReportModal
        isOpen={Boolean(printableMonth)}
        onClose={() => setPrintableMonth(null)}
        monthYear={printableMonth || selectedMonth}
        receipts={receipts}
        currencyCode={currencyCode}
      />

      <BudgetLimitsModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        budgets={categoryBudgets}
        onSaveBudgets={handleSaveBudgets}
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
        onSaveExtractedReceipts={handleSaveBatchReceipts}
      />

      <UpgradeProModal
        isOpen={upgradeModalState.open}
        onClose={() => setUpgradeModalState((prev) => ({ ...prev, open: false }))}
        reason={upgradeModalState.reason}
        currencyCode={currencyCode}
        subscriptionState={subscriptionState}
        onSubscriptionUpdated={(next) => setSubscriptionState(next)}
      />
    </div>
  );
}

export default App;
