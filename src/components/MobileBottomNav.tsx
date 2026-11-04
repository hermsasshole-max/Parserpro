import React, { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Receipt,
  BarChart3,
  Users,
  Package,
  Settings,
  Database,
  Menu,
  X,
} from 'lucide-react';
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
  const [menuOpen, setMenuOpen] = useState(false);

  const primaryTabs: {
    id: NavTab;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'dashboard', label: 'Field', icon: LayoutDashboard },
    { id: 'quotes', label: 'Quotes', icon: FileText },
    { id: 'invoices', label: 'Invoices', icon: CreditCard },
    {
      id: 'expenses',
      label: receiptCount > 0 ? `Expenses (${receiptCount})` : 'Expenses',
      icon: Receipt,
    },
  ];

  const secondaryMenuTabs: {
    id: NavTab;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'reports', label: 'Financial Analytics', icon: BarChart3 },
    { id: 'clients', label: 'Clients Directory', icon: Users },
    { id: 'inventory', label: 'Van Stock & Materials', icon: Package },
    { id: 'schema', label: 'SQLite & Cloud DB', icon: Database },
    { id: 'settings', label: 'Account & Backup', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Drawer for More Items */}
      {menuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end p-2 pb-safe"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 px-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Contractor Field Tools
              </span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {secondaryMenuTabs.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMenuOpen(false);
                    }}
                    className={`p-3 rounded-2xl flex items-center gap-2.5 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Sticky Bottom Nav */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] pb-safe"
      >
        <div className="grid grid-cols-5 items-center h-[58px] px-1 pt-1">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              activeTab === tab.id ||
              (tab.id === 'dashboard' && activeTab === 'scanner') ||
              (tab.id === 'expenses' && activeTab === 'receipts');
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[48px] min-w-[44px] flex flex-col items-center justify-center py-1 px-1 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-xl active:scale-[0.97] cursor-pointer ${
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-[10px] font-medium tracking-tight mt-0.5 truncate max-w-full whitespace-nowrap">
                  {tab.label}
                </span>
              </button>
            );
          })}

          {/* More Menu Trigger */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className={`min-h-[48px] min-w-[44px] flex flex-col items-center justify-center py-1 px-1 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-xl active:scale-[0.97] cursor-pointer ${
              secondaryMenuTabs.some((t) => t.id === activeTab)
                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Menu className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-medium tracking-tight mt-0.5 truncate max-w-full whitespace-nowrap">
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
