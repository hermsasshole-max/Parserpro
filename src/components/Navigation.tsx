import React from 'react';
import { ScanLine, Layers, TrendingUp, Printer, Smartphone, Settings } from 'lucide-react';

interface NavigationProps {
  activeTab: 'scanner' | 'receipts' | 'report' | 'settings';
  setActiveTab: (tab: 'scanner' | 'receipts' | 'report' | 'settings') => void;
  receiptCount: number;
  onOpenPrintReport: () => void;
  onOpenInstallModal: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  receiptCount,
  onOpenPrintReport,
  onOpenInstallModal,
}) => {
  return (
    <nav className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-sm z-10 shrink-0 no-print">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
        </div>
        <div>
          <span className="text-xl font-bold tracking-tight text-slate-800">
            Parser<span className="text-emerald-600">Pro</span>
          </span>
          <span className="hidden md:inline-block ml-2 text-xs font-semibold text-slate-400">
            Expenditure & Grocery Intelligence
          </span>
        </div>
      </div>

      {/* Center Tabs */}
      <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'scanner'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ScanLine className="w-3.5 h-3.5" />
          <span>Scanner</span>
        </button>

        <button
          onClick={() => setActiveTab('receipts')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'receipts'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Receipts</span>
          <span className="sm:hidden">Receipts</span>
          <span className="ml-0.5 px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[10px]">
            {receiptCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('report')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'report'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Report</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'settings'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Settings</span>
        </button>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Install on Android Button */}
        <button
          id="install-android-btn"
          onClick={onOpenInstallModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow"
          title="Install to Android phone"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Install to Android</span>
          <span className="sm:hidden">Install</span>
        </button>

        <button
          onClick={onOpenPrintReport}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors shadow-sm"
          title="Print or Export PDF of Monthly Report"
        >
          <Printer className="w-3.5 h-3.5 text-slate-600" />
          <span>Print / PDF</span>
        </button>
        <div className="flex items-center gap-1.5">
          <span className="hidden lg:inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-100">
            ZAR (R)
          </span>
        </div>
      </div>
    </nav>
  );
};

