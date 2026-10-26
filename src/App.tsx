import React, { useState, useEffect, useMemo } from 'react';
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

function getCurrentMonthIso(): string {
  return new Date().toISOString().substring(0, 7);
}

function getPreviousMonthIso(monthIso: string): string {
  const [y, m] = monthIso.split('-').map(Number);
  const d = new Date(y, (m || 1) - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Strips any legacy pre-seeded demo items (`sample-*`) so published Play Store users
 * always get a clean personal ledger while preserving all real user-scanned receipts.
 */
function stripLegacySampleData(items: SavedReceipt[]): SavedReceipt[] {
  return items.filter((r) => !String(r.id || '').startsWith('sample-'));
}

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('scanner');
  const [receipts, setReceipts] = useState<SavedReceipt[]>(() => {
    try {
      const raw = localStorage.getItem('parserpro_saved_receipts_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return stripLegacySampleData(parsed);
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
      const cleaned = stripLegacySampleData(stored);
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
    const updated = [...newReceipts, ...receipts];
    persistReceipts(updated);
    const newestMonth = newReceipts[0]?.month_year;
    if (newestMonth) {
      setSelectedMonth(newestMonth);
    }
  };

  const handleSaveSingleManualReceipt = (newReceipt: SavedReceipt) => {
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

  const isPlus = subscriptionState.tier === 'plus';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isPlus={isPlus}
        onOpenUpgrade={openUpgradeModal}
        onOpenAddManual={() => setIsAddModalOpen(true)}
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-24 sm:pb-12">
        {activeTab === 'scanner' && (
          <ReceiptScanner
            existingReceipts={receipts}
            subscriptionState={subscriptionState}
            currencyCode={currencyCode}
            pendingOfflineCount={pendingOfflineCount}
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
            isPlus={isPlus}
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
        isPlus={isPlus}
        currencyCode={currencyCode}
        onOpenUpgrade={openUpgradeModal}
      />

      <AndroidBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        receipts={receipts}
        onRestoreReceipts={(restored) => persistReceipts(restored)}
        isPlus={isPlus}
        currencyCode={currencyCode}
        onOpenUpgrade={openUpgradeModal}
      />

      <OfflineOcrQueueModal
        isOpen={isOfflineQueueOpen}
        onClose={() => setIsOfflineQueueOpen(false)}
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
