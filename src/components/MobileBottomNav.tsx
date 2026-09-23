import React from 'react';
import { ScanLine, Layers, TrendingUp, Settings, Grid, Plus } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'scanner' | 'receipts' | 'report' | 'settings';
  setActiveTab: (tab: 'scanner' | 'receipts' | 'report' | 'settings') => void;
  receiptCount: number;
  onOpenQuickMenu: () => void;
  onOpenAddManual: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  receiptCount,
  onOpenQuickMenu,
  onOpenAddManual
}) => {
  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg no-print">
      {/* Scanner */}
      <button
        onClick={() => setActiveTab('scanner')}
        className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
          activeTab === 'scanner' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        <div className={`p-1 rounded-lg ${activeTab === 'scanner' ? 'bg-emerald-50' : ''}`}>
          <ScanLine className="w-5 h-5" />
        </div>
        <span className="text-[10px] tracking-tight mt-0.5">Scan</span>
      </button>

      {/* Receipts */}
      <button
        onClick={() => setActiveTab('receipts')}
        className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all relative cursor-pointer ${
          activeTab === 'receipts' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        <div className={`p-1 rounded-lg relative ${activeTab === 'receipts' ? 'bg-emerald-50' : ''}`}>
          <Layers className="w-5 h-5" />
          {receiptCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-emerald-600 text-white font-mono text-[9px] px-1 py-0.2 rounded-full font-bold">
              {receiptCount > 99 ? '99+' : receiptCount}
            </span>
          )}
        </div>
        <span className="text-[10px] tracking-tight mt-0.5">Receipts</span>
      </button>

      {/* Center Action Button: Quick Menu / Features Hub */}
      <div className="flex-1 flex items-center justify-center px-1">
        <button
          onClick={onOpenQuickMenu}
          className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white shadow-md active:scale-95 flex items-center justify-center transition-all cursor-pointer -mt-4 border-2 border-white"
          title="Open Features Menu"
        >
          <Grid className="w-5 h-5" />
        </button>
      </div>

      {/* Report */}
      <button
        onClick={() => setActiveTab('report')}
        className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
          activeTab === 'report' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        <div className={`p-1 rounded-lg ${activeTab === 'report' ? 'bg-emerald-50' : ''}`}>
          <TrendingUp className="w-5 h-5" />
        </div>
        <span className="text-[10px] tracking-tight mt-0.5">Report</span>
      </button>

      {/* Settings */}
      <button
        onClick={() => setActiveTab('settings')}
        className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
          activeTab === 'settings' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        <div className={`p-1 rounded-lg ${activeTab === 'settings' ? 'bg-emerald-50' : ''}`}>
          <Settings className="w-5 h-5" />
        </div>
        <span className="text-[10px] tracking-tight mt-0.5">Settings</span>
      </button>
    </div>
  );
};
