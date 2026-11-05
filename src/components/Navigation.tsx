import React, { useState, useRef, useEffect } from 'react';
import type { SubscriptionTier, UpgradeTriggerReason } from '../utils/subscriptionManager';
import { ChevronDown, Sparkles } from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'quotes'
  | 'invoices'
  | 'expenses'
  | 'reports'
  | 'clients'
  | 'inventory'
  | 'settings'
  | 'schema'
  | 'scanner'
  | 'receipts';

interface NavigationProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  tier: SubscriptionTier;
  onOpenUpgrade: (reason?: UpgradeTriggerReason) => void;
  onOpenAddManual: () => void;
  onOpenVoiceQuote?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  tier,
  onOpenUpgrade,
  onOpenAddManual,
  onOpenVoiceQuote,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const primaryNavItems: { id: NavTab; label: string }[] = [
    { id: 'dashboard', label: 'Household Overview' },
    { id: 'expenses', label: 'Expenses & Scans' },
    { id: 'reports', label: 'Monthly Analytics' },
  ];

  const secondaryNavItems: { id: NavTab; label: string }[] = [
    { id: 'schema', label: 'SQLite & Database' },
    { id: 'settings', label: 'Preferences & Backup' },
  ];

  const isSecondaryActive = secondaryNavItems.some(
    (item) => item.id === activeTab || (item.id === 'settings' && activeTab === 'settings')
  );

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors pt-safe">
      <div className="max-w-6xl mx-auto h-12 sm:h-14 px-4 sm:px-6 flex items-center justify-between gap-6">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-md min-h-[44px] flex items-center cursor-pointer"
        >
          ParserPro <span className="text-xs font-semibold text-emerald-600 ml-1.5 hidden md:inline">Household Budget</span>
        </button>

        {/* Zone 2: Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {primaryNavItems.map((item) => {
            const isActive =
              activeTab === item.id ||
              (item.id === 'dashboard' && (activeTab === 'scanner' || activeTab === 'dashboard')) ||
              (item.id === 'expenses' && (activeTab === 'receipts' || activeTab === 'expenses'));
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative min-h-[44px] flex items-center whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-sm cursor-pointer ${
                  isActive
                    ? 'text-slate-900 dark:text-white font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-emerald-600 dark:after:bg-emerald-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}

          {/* More Dropdown for Clients, Inventory, SQL Schema, Settings */}
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen(!moreOpen)}
              className={`min-h-[44px] flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-sm cursor-pointer ${
                isSecondaryActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Field Tools</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {moreOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-1.5 z-50 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="space-y-0.5">
                  {secondaryNavItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setMoreOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between ${
                        activeTab === item.id
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Zone 3: Voice Quote + Plans / Tier Action */}
        <div className="flex items-center gap-2 shrink-0">


          {tier === 'full' ? (
            <button
              type="button"
              onClick={() => onOpenUpgrade('general')}
              className="min-h-[42px] px-3.5 py-2 text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 rounded-xl transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 font-mono tabular-nums cursor-pointer"
            >
              Full · $3.99
            </button>
          ) : tier === 'mid' ? (
            <button
              type="button"
              onClick={() => onOpenUpgrade('general')}
              className="min-h-[42px] px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 font-mono tabular-nums cursor-pointer"
            >
              Mid · Go $3.99
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenUpgrade('general')}
              className="min-h-[42px] px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 font-mono tabular-nums cursor-pointer"
            >
              Plans · $1.99 / $3.99
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navigation;
