import React from 'react';
import { Camera, Receipt, BarChart3, User } from 'lucide-react';
import type { NavTab } from './Navigation';

interface MobileBottomNavProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  receiptCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  receiptCount,
}) => {
  const tabs: {
    id: NavTab;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'scanner', label: 'Scan', icon: Camera },
    {
      id: 'receipts',
      label: receiptCount > 0 ? `Receipts (${receiptCount})` : 'Receipts',
      icon: Receipt,
    },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Account', icon: User },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] pb-safe"
    >
      <div className="grid grid-cols-4 items-center h-[58px] px-1.5 pt-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[48px] min-w-[48px] flex flex-col items-center justify-center py-1 px-1 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-xl active:scale-[0.97] ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[11px] font-medium tracking-tight mt-0.5 truncate max-w-full whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
