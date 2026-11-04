import React from 'react';
import { SettingsView } from './SettingsView';
import { useAppContext } from '../context/AppContext';
import { Sun } from 'lucide-react';

interface SettingsManagerProps {
  onOpenUpgrade: (reason: any) => void;
  onOpenBudgetModal: () => void;
  onOpenBackupModal: () => void;
  onOpenOfflineQueue: () => void;
  onResetAllReceipts: () => void;
  pendingOfflineCount: number;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({
  onOpenUpgrade,
  onOpenBudgetModal,
  onOpenBackupModal,
  onOpenOfflineQueue,
  onResetAllReceipts,
  pendingOfflineCount,
}) => {
  const {
    receipts,
    subscriptionState,
    currencyCode,
    changeCurrency,
    darkMode,
    setDarkMode,
    sunlightMode,
    toggleSunlightMode,
  } = useAppContext();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Sunlight Mode Quick Toggle Card */}
      <section className="p-4 sm:p-5 rounded-3xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/30 flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Jobsite Sunlight Mode
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Ultra-high contrast daylight visibility for reading screens outdoors under direct sun.
          </p>
        </div>

        <button
          type="button"
          onClick={toggleSunlightMode}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            sunlightMode
              ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
              : 'border border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20'
          }`}
        >
          {sunlightMode ? 'Sunlight Active ON' : 'Enable Sunlight Mode'}
        </button>
      </section>

      <SettingsView
        receipts={receipts}
        subscriptionState={subscriptionState}
        currencyCode={currencyCode}
        onCurrencyChange={changeCurrency}
        darkMode={darkMode}
        onToggleDarkMode={setDarkMode}
        pendingOfflineCount={pendingOfflineCount}
        onOpenUpgrade={onOpenUpgrade}
        onOpenBudgetModal={onOpenBudgetModal}
        onOpenBackupModal={onOpenBackupModal}
        onOpenOfflineQueue={onOpenOfflineQueue}
        onResetAllReceipts={onResetAllReceipts}
      />
    </div>
  );
};

export default SettingsManager;
