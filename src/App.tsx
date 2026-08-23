import { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { ReceiptScanner } from './components/ReceiptScanner';
import { MonthlyReceiptsList } from './components/MonthlyReceiptsList';
import { MonthToMonthReport } from './components/MonthToMonthReport';
import { SettingsView } from './components/SettingsView';
import { PrintableReportModal } from './components/PrintableReportModal';
import { AddReceiptModal } from './components/AddReceiptModal';
import { EditReceiptModal } from './components/EditReceiptModal';
import { InstallModal } from './components/InstallModal';
import type { SavedReceipt } from './types';

const STORAGE_KEY = 'parserpro_saved_receipts_v1';

export default function App() {
  const currentMonthDefault = new Date().toISOString().substring(0, 7);

  const [receipts, setReceipts] = useState<SavedReceipt[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading receipts from localStorage:', e);
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState<'scanner' | 'receipts' | 'report' | 'settings'>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab === 'receipts' || tab === 'report' || tab === 'settings' || tab === 'scanner') {
          return tab;
        }
      }
    } catch (e) {
      console.warn('Error reading url params:', e);
    }
    return 'scanner';
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthDefault);
  const [comparisonMonth, setComparisonMonth] = useState<string>(currentMonthDefault);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<SavedReceipt | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [saveToast, setSaveToast] = useState<{ message: string; month?: string } | null>(null);

  // Capture beforeinstallprompt for Android & Chrome PWA
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setSaveToast({
        message: 'ParserPro successfully installed on your Android device!',
        month: selectedMonth
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [selectedMonth]);

  // Sync to local storage on changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
    } catch (e) {
      console.error('Error persisting receipts:', e);
    }
  }, [receipts]);

  const handleReceiptSaved = (newReceipt: SavedReceipt) => {
    setReceipts(prev => [newReceipt, ...prev]);
    setSelectedMonth(newReceipt.month_year);
    setSaveToast({
      message: `Scanned & filed to ${newReceipt.month_year} on ${newReceipt.invoice_date}`,
      month: newReceipt.month_year
    });
    setTimeout(() => setSaveToast(null), 5000);
  };

  const handleUpdateReceipt = (updatedReceipt: SavedReceipt) => {
    setReceipts(prev => prev.map(r => r.id === updatedReceipt.id ? updatedReceipt : r));
    setSaveToast({
      message: `Invoice for ${updatedReceipt.vendor_name} successfully updated!`,
      month: updatedReceipt.month_year
    });
    setTimeout(() => setSaveToast(null), 4000);
  };

  const handleDeleteReceipt = (id: string) => {
    setReceipts(prev => prev.filter(r => r.id !== id));
  };

  const handleResetAllData = () => {
    setReceipts([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Error resetting storage:', e);
    }
    setSaveToast({
      message: 'All invoices and totals have been reset to 0.',
    });
    setTimeout(() => setSaveToast(null), 4000);
  };

  const handleResetMonthData = (monthYear: string) => {
    setReceipts(prev => prev.filter(r => r.month_year !== monthYear));
    setSaveToast({
      message: `All invoices for ${monthYear} have been cleared.`,
      month: monthYear
    });
    setTimeout(() => setSaveToast(null), 4000);
  };

  const handleImportData = (imported: SavedReceipt[]) => {
    setReceipts(imported);
    if (imported.length > 0) {
      setSelectedMonth(imported[0].month_year);
    }
  };

  const handleGoToReport = (month: string) => {
    setSelectedMonth(month);
    // Find prior month if available
    const available = Array.from(new Set<string>(receipts.map(r => r.month_year))).sort((a, b) => b.localeCompare(a));
    const currentIndex = available.indexOf(month);
    if (currentIndex !== -1 && currentIndex + 1 < available.length) {
      setComparisonMonth(available[currentIndex + 1]);
    }
    setActiveTab('report');
  };

  const handleViewMonth = (month: string) => {
    setSelectedMonth(month);
    setActiveTab('receipts');
  };

  return (
    <div className="h-[100dvh] min-h-[100dvh] w-full bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden select-none sm:select-auto">
      {/* Sleek Navigation Bar */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        receiptCount={receipts.length}
        onOpenPrintReport={() => setIsPrintModalOpen(true)}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
      />

      {/* Save Notification Toast */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-3 text-xs animate-bounce">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
          <div>
            <div className="font-bold text-emerald-400">Notification</div>
            <div className="text-slate-300">{saveToast.message}</div>
          </div>
          {saveToast.month && (
            <button
              onClick={() => {
                if (saveToast.month) {
                  handleGoToReport(saveToast.month);
                }
                setSaveToast(null);
              }}
              className="ml-2 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold"
            >
              View
            </button>
          )}
        </div>
      )}

      {/* Tab Views */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'scanner' && (
          <ReceiptScanner
            onReceiptSaved={handleReceiptSaved}
            onViewMonth={handleViewMonth}
            recentReceipts={receipts}
          />
        )}

        {activeTab === 'receipts' && (
          <MonthlyReceiptsList
            receipts={receipts}
            onDeleteReceipt={handleDeleteReceipt}
            onEditReceipt={(r) => setEditingReceipt(r)}
            onAddManualReceipt={() => setIsAddModalOpen(true)}
            onGoToReport={handleGoToReport}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
          />
        )}

        {activeTab === 'report' && (
          <MonthToMonthReport
            receipts={receipts}
            initialMonthA={selectedMonth}
            initialMonthB={comparisonMonth}
            onOpenPrintReport={() => setIsPrintModalOpen(true)}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            receipts={receipts}
            onResetAllData={handleResetAllData}
            onResetMonthData={handleResetMonthData}
            onEditReceipt={(r) => setEditingReceipt(r)}
            onDeleteReceipt={handleDeleteReceipt}
            onAddManualReceipt={() => setIsAddModalOpen(true)}
            onImportData={handleImportData}
          />
        )}
      </main>

      {/* Printable Report / PDF Export Modal */}
      {isPrintModalOpen && (
        <PrintableReportModal
          receipts={receipts}
          monthA={selectedMonth}
          monthB={comparisonMonth}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}

      {/* Add Manual Receipt Modal */}
      {isAddModalOpen && (
        <AddReceiptModal
          defaultMonth={selectedMonth}
          onClose={() => setIsAddModalOpen(false)}
          onSave={handleReceiptSaved}
        />
      )}

      {/* Edit Invoice Modal */}
      {editingReceipt && (
        <EditReceiptModal
          receipt={editingReceipt}
          onClose={() => setEditingReceipt(null)}
          onSave={handleUpdateReceipt}
        />
      )}

      {/* Android Install PWA Modal */}
      {isInstallModalOpen && (
        <InstallModal
          isOpen={isInstallModalOpen}
          onClose={() => setIsInstallModalOpen(false)}
          deferredPrompt={deferredPrompt}
          onInstallSuccess={() => {
            setIsInstallModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

