import React from 'react';
import { 
  ScanLine, 
  Layers, 
  TrendingUp, 
  Printer, 
  Smartphone, 
  Settings, 
  Search, 
  Grid, 
  Plus, 
  Sparkles,
  Command,
  HardDrive
} from 'lucide-react';

interface NavigationProps {
  activeTab: 'scanner' | 'receipts' | 'report' | 'settings';
  setActiveTab: (tab: 'scanner' | 'receipts' | 'report' | 'settings') => void;
  receiptCount: number;
  onOpenPrintReport: () => void;
  onOpenInstallModal: () => void;
  onOpenSearch: () => void;
  onOpenQuickMenu: () => void;
  onOpenAddManual: () => void;
  onOpenBackupModal: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  receiptCount,
  onOpenPrintReport,
  onOpenInstallModal,
  onOpenSearch,
  onOpenQuickMenu,
  onOpenAddManual,
  onOpenBackupModal,
}) => {
  return (
    <nav className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between shadow-xs z-30 shrink-0 no-print">
      {/* Brand & Left Elements */}
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={() => setActiveTab('scanner')}
          className="flex items-center gap-2.5 text-left group cursor-pointer"
        >
          <div className="w-9 h-9 bg-emerald-600 group-hover:bg-emerald-700 rounded-xl flex items-center justify-center shadow-xs transition-colors">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
                Parser<span className="text-emerald-600">Pro</span>
              </span>
              <span className="hidden xl:inline-block px-1.5 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-md border border-emerald-200">
                ZAR
              </span>
            </div>
            <span className="hidden md:block text-[11px] font-medium text-slate-400 -mt-0.5">
              Expenditure & Grocery Intelligence
            </span>
          </div>
        </button>

        {/* Global Search Button (Desktop & Tablet) */}
        <button
          onClick={onOpenSearch}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl border border-slate-200 text-xs font-medium transition-colors cursor-pointer w-48 lg:w-64"
          title="Search receipts, items or stores (Ctrl/Cmd + K)"
        >
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">Search receipts & items...</span>
          <kbd className="ml-auto text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-400">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Center Tabs (Desktop & Tablet) */}
      <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'scanner'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ScanLine className="w-3.5 h-3.5" />
          <span>Scanner</span>
        </button>

        <button
          onClick={() => setActiveTab('receipts')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'receipts'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Receipts</span>
          <span className="ml-0.5 px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[10px] font-mono font-bold">
            {receiptCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('report')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'report'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>MoM Report</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Settings</span>
        </button>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Mobile Search Button */}
        <button
          onClick={onOpenSearch}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Search receipts"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Quick Add Manual Receipt Button */}
        <button
          onClick={onOpenAddManual}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          title="Manually enter a receipt or grocery bill"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Receipt</span>
        </button>

        {/* Features Hub / Quick Menu Button */}
        <button
          onClick={onOpenQuickMenu}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors border border-slate-200 cursor-pointer"
          title="Browse all menus and tools"
        >
          <Grid className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden md:inline">Features</span>
        </button>

        {/* Device Backup Button */}
        <button
          onClick={onOpenBackupModal}
          className="hidden md:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          title="Backup & restore receipts on Android device"
        >
          <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden xl:inline">Device Backup</span>
        </button>

        {/* Print / PDF Button */}
        <button
          onClick={onOpenPrintReport}
          className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
          title="Print or Export PDF of Monthly Report"
        >
          <Printer className="w-3.5 h-3.5 text-slate-600" />
          <span className="hidden xl:inline">Print / PDF</span>
        </button>

        {/* Install on Android Button */}
        <button
          id="install-android-btn"
          onClick={onOpenInstallModal}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs hover:shadow cursor-pointer"
          title="Install to Android phone or download APK"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Android APK</span>
          <span className="sm:hidden">APK</span>
        </button>
      </div>
    </nav>
  );
};


