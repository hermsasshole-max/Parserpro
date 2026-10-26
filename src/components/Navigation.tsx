import React from 'react';
import type { UpgradeTriggerReason } from '../utils/subscriptionManager';

export type NavTab = 'scanner' | 'receipts' | 'reports' | 'settings';

interface NavigationProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isPlus: boolean;
  onOpenUpgrade: (reason?: UpgradeTriggerReason) => void;
  onOpenAddManual: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  isPlus,
  onOpenUpgrade,
  onOpenAddManual,
}) => {
  const navItems: { id: NavTab; label: string }[] = [
    { id: 'scanner', label: 'Scan' },
    { id: 'receipts', label: 'Receipts' },
    { id: 'reports', label: 'Insights' },
    { id: 'settings', label: 'Account' },
  ];

  return (
    <header className="sticky top-0 z-30 h-12 sm:h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab('scanner')}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-md min-h-[44px] flex items-center"
        >
          ParserPro
        </button>

        {/* Zone 2: 4 Clean Single-Line Text Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden sm:flex items-center gap-7 text-sm font-medium"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative min-h-[44px] flex items-center whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-sm ${
                  isActive
                    ? 'text-slate-900 dark:text-white font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-emerald-600 dark:after:bg-emerald-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          {isPlus ? (
            <button
              type="button"
              onClick={onOpenAddManual}
              className="min-h-[40px] px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-xl transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              Add Receipt
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenUpgrade('general')}
              className="min-h-[40px] px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              Upgrade to Plus
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
