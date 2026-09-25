import React from 'react';
import {
  X,
  ScanLine,
  Layers,
  TrendingUp,
  Settings,
  Printer,
  Search,
  PlusCircle,
  Smartphone,
  Download,
  Upload,
  Database,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';

interface QuickMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: 'scanner' | 'receipts' | 'report' | 'settings') => void;
  onOpenScannerCamera: () => void;
  onOpenAddManual: () => void;
  onOpenSearch: () => void;
  onOpenPrintReport: () => void;
  onOpenInstallModal: () => void;
  onLoadSampleData: () => void;
  receiptCount: number;
}

export const QuickMenuModal: React.FC<QuickMenuModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenScannerCamera,
  onOpenAddManual,
  onOpenSearch,
  onOpenPrintReport,
  onOpenInstallModal,
  onLoadSampleData,
  receiptCount
}) => {
  if (!isOpen) return null;

  const handleAction = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">ParserPro Feature Menu</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Instant access to all scanner, analysis & data features
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Menu Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-slate-800">
          {/* Main Navigation Views */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Primary Views
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                onClick={() => handleAction(() => onNavigate('scanner'))}
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 flex flex-col items-center text-center transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <ScanLine className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">AI Scanner</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Vision OCR</span>
              </button>

              <button
                onClick={() => handleAction(() => onNavigate('receipts'))}
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 flex flex-col items-center text-center transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">Receipts</span>
                <span className="text-[10px] text-slate-500 mt-0.5">{receiptCount} saved</span>
              </button>

              <button
                onClick={() => handleAction(() => onNavigate('report'))}
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 flex flex-col items-center text-center transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">MoM Report</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Analytics</span>
              </button>

              <button
                onClick={() => handleAction(() => onNavigate('settings'))}
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 flex flex-col items-center text-center transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Settings className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">Settings</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Data & Storage</span>
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Quick Actions
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <button
                onClick={() => handleAction(onOpenAddManual)}
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-slate-50 flex items-center justify-between text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <PlusCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Add Manual Receipt</div>
                    <div className="text-slate-500 text-[11px]">Type in custom store & items</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </button>

              <button
                onClick={() => handleAction(onOpenSearch)}
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-slate-50 flex items-center justify-between text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Global Search</div>
                    <div className="text-slate-500 text-[11px]">Find any store, date or item</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </button>

              <button
                onClick={() => handleAction(onOpenPrintReport)}
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-slate-50 flex items-center justify-between text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Print / Export PDF</div>
                    <div className="text-slate-500 text-[11px]">Generate monthly expense sheets</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </button>

              <button
                onClick={() => handleAction(onOpenInstallModal)}
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-slate-50 flex items-center justify-between text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Android APK & Install</div>
                    <div className="text-slate-500 text-[11px]">Native app & PWA install</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </button>
            </div>
          </div>

          {/* Tools & Settings */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Tools & Data Management
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => handleAction(onLoadSampleData)}
                className="p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-2.5 text-left text-slate-700 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold">Load Realistic Sample Receipts</span>
                  <span className="block text-[10px] text-slate-500">Pick n Pay, Woolworths, Eskom</span>
                </div>
              </button>

              <button
                onClick={() => handleAction(() => onNavigate('settings'))}
                className="p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-2.5 text-left text-slate-700 cursor-pointer"
              >
                <Settings className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold">Settings & Ledger Control</span>
                  <span className="block text-[10px] text-slate-500">Backups, Reset Totals & Data</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium">Currency: ZAR (R) · Offline Ready</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
