import React, { createContext, useContext, useState, useEffect } from 'react';
import type { SavedReceipt, CategoryBudgets } from '../types';
import {
  loadReceiptsFromDevice,
  saveReceiptsToDevice,
  stripLegacyDemoReceipts,
  requestPersistentDeviceStorage,
} from '../utils/deviceStorage';
import { loadCategoryBudgets, saveCategoryBudgets } from '../utils/budgetStorage';
import {
  getSubscriptionState,
  subscribeToSubscriptionChanges,
  type SubscriptionState,
  type SubscriptionTier,
} from '../utils/subscriptionManager';
import { getPreferredCurrency, setPreferredCurrency } from '../utils/currencyFormat';

export interface ClientRecord {
  id: string;
  name: string;
  company?: string;
  phone: string;
  email?: string;
  address?: string;
  totalBilled: number;
  outstandingBalance: number;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unitCost: number;
  unitPrice: number;
  location?: string;
}

export interface QuoteRecord {
  id: string;
  quoteNumber: string;
  clientName: string;
  clientPhone?: string;
  projectTitle: string;
  date: string;
  expiryDate: string;
  status: 'draft' | 'sent' | 'accepted' | 'declined';
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    isLabour?: boolean;
  }[];
  totalAmount: number;
  notes?: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  clientName: string;
  date: string;
  dueDate: string;
  status: 'draft' | 'pending' | 'paid' | 'overdue';
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  totalAmount: number;
  amountPaid: number;
}

interface AppContextType {
  receipts: SavedReceipt[];
  setReceipts: React.Dispatch<React.SetStateAction<SavedReceipt[]>>;
  persistReceipts: (updated: SavedReceipt[]) => void;
  categoryBudgets: CategoryBudgets;
  saveBudgets: (next: CategoryBudgets) => void;
  subscriptionState: SubscriptionState;
  tier: SubscriptionTier;
  currencyCode: string;
  changeCurrency: (code: string) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  sunlightMode: boolean;
  setSunlightMode: (val: boolean) => void;
  toggleSunlightMode: () => void;
  clients: ClientRecord[];
  setClients: React.Dispatch<React.SetStateAction<ClientRecord[]>>;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  quotes: QuoteRecord[];
  setQuotes: React.Dispatch<React.SetStateAction<QuoteRecord[]>>;
  invoices: InvoiceRecord[];
  setInvoices: React.Dispatch<React.SetStateAction<InvoiceRecord[]>>;
}

const AppContext = createContext<AppContextType | null>(null);

const DEFAULT_CLIENTS: ClientRecord[] = [
  {
    id: 'cli-1',
    name: 'Johannesburg Metro Hardware',
    company: 'JMH Supplies',
    phone: '+27 11 555 0192',
    email: 'accounts@jmhhardware.co.za',
    address: '14 Commerce Cres, Sandton',
    totalBilled: 14250.0,
    outstandingBalance: 0,
  },
  {
    id: 'cli-2',
    name: 'Pretoria East Residential',
    company: 'Van der Merwe Estates',
    phone: '+27 12 555 4821',
    email: 'info@vdmfarm.co.za',
    address: '88 Garsfontein Rd, Pretoria',
    totalBilled: 8900.0,
    outstandingBalance: 1200.0,
  },
];

const DEFAULT_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-1',
    sku: 'CON-WIRE-2.5',
    name: '2.5mm Twin & Earth Cable (100m)',
    category: 'Electrical',
    quantity: 6,
    minQuantity: 3,
    unitCost: 895.0,
    unitPrice: 1250.0,
    location: 'Van Bin 1',
  },
  {
    id: 'inv-2',
    sku: 'CON-PIPE-COPPER',
    name: '15mm Copper Tube (5.5m)',
    category: 'Plumbing',
    quantity: 12,
    minQuantity: 5,
    unitCost: 285.0,
    unitPrice: 420.0,
    location: 'Van Rack A',
  },
  {
    id: 'inv-3',
    sku: 'CON-FAST-DRYWALL',
    name: 'Drywall Screws 35mm (Box 1000)',
    category: 'Hardware',
    quantity: 4,
    minQuantity: 2,
    unitCost: 145.0,
    unitPrice: 210.0,
    location: 'Workshop Shelf 2',
  },
];

const DEFAULT_QUOTES: QuoteRecord[] = [
  {
    id: 'quo-101',
    quoteNumber: 'Q-2026-088',
    clientName: 'Pretoria East Residential',
    clientPhone: '+27 12 555 4821',
    projectTitle: 'Sub-Distribution Board & Geyser Timer Installation',
    date: '2026-10-28',
    expiryDate: '2026-11-28',
    status: 'sent',
    items: [
      { description: 'On-site Assessment & Labor (4 hrs)', quantity: 4, unitPrice: 450, total: 1800, isLabour: true },
      { description: ' Hager 12-way Din Rail Consumer Unit', quantity: 1, unitPrice: 750, total: 750 },
      { description: 'CBI Electronic Digital Timer 24hr', quantity: 1, unitPrice: 620, total: 620 },
      { description: 'Consumables, gland pack & conduit', quantity: 1, unitPrice: 380, total: 380 },
    ],
    totalAmount: 3550.0,
    notes: 'Includes electrical certificate of compliance (CoC). Valid 30 days.',
  },
];

const DEFAULT_INVOICES: InvoiceRecord[] = [
  {
    id: 'inv-201',
    invoiceNumber: 'INV-2026-042',
    clientName: 'Johannesburg Metro Hardware',
    date: '2026-10-24',
    dueDate: '2026-11-07',
    status: 'paid',
    items: [
      { description: 'Emergency Call-out & Breaker Replacement', quantity: 1, unitPrice: 1650, total: 1650 },
      { description: 'Siemens 63A Double Pole Main Switch', quantity: 1, unitPrice: 850, total: 850 },
    ],
    totalAmount: 2500.0,
    amountPaid: 2500.0,
  },
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [receipts, setReceipts] = useState<SavedReceipt[]>(() => {
    try {
      const raw = localStorage.getItem('parserpro_saved_receipts_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return stripLegacyDemoReceipts(parsed);
      }
    } catch {}
    return [];
  });

  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudgets>(() =>
    loadCategoryBudgets()
  );

  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>(() =>
    getSubscriptionState()
  );

  const [currencyCode, setCurrencyCode] = useState<string>(() => getPreferredCurrency());

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('parserpro_dark_mode') === 'true';
    } catch {
      return false;
    }
  });

  const [sunlightMode, setSunlightMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('parserpro_sunlight_mode') === 'true';
    } catch {
      return false;
    }
  });

  const [clients, setClients] = useState<ClientRecord[]>(() => {
    try {
      const raw = localStorage.getItem('parserpro_clients_v1');
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_CLIENTS;
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    try {
      const raw = localStorage.getItem('parserpro_inventory_v1');
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_INVENTORY;
  });

  const [quotes, setQuotes] = useState<QuoteRecord[]>(() => {
    try {
      const raw = localStorage.getItem('parserpro_quotes_v1');
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_QUOTES;
  });

  const [invoices, setInvoices] = useState<InvoiceRecord[]>(() => {
    try {
      const raw = localStorage.getItem('parserpro_invoices_v1');
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_INVOICES;
  });

  // Storage persistence and hydration
  useEffect(() => {
    requestPersistentDeviceStorage().catch(() => {});
    loadReceiptsFromDevice().then((stored) => {
      const cleaned = stripLegacyDemoReceipts(stored);
      if (cleaned.length !== stored.length) {
        saveReceiptsToDevice(cleaned).catch(() => {});
      }
      setReceipts(cleaned);
    });
  }, []);

  // Sync clients, inventory, quotes, invoices to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('parserpro_clients_v1', JSON.stringify(clients));
    } catch {}
  }, [clients]);

  useEffect(() => {
    try {
      localStorage.setItem('parserpro_inventory_v1', JSON.stringify(inventory));
    } catch {}
  }, [inventory]);

  useEffect(() => {
    try {
      localStorage.setItem('parserpro_quotes_v1', JSON.stringify(quotes));
    } catch {}
  }, [quotes]);

  useEffect(() => {
    try {
      localStorage.setItem('parserpro_invoices_v1', JSON.stringify(invoices));
    } catch {}
  }, [invoices]);

  // Dark Mode class application
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode && !sunlightMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('parserpro_dark_mode', String(darkMode));
    } catch {}
  }, [darkMode, sunlightMode]);

  // Sunlight Mode class application (ultra-high contrast daylight visibility)
  useEffect(() => {
    const root = document.documentElement;
    if (sunlightMode) {
      root.classList.add('sunlight-mode');
      root.setAttribute('data-theme', 'sunlight');
    } else {
      root.classList.remove('sunlight-mode');
      root.removeAttribute('data-theme');
    }
    try {
      localStorage.setItem('parserpro_sunlight_mode', String(sunlightMode));
    } catch {}
  }, [sunlightMode]);

  // Subscription manager sync
  useEffect(() => {
    const unsub = subscribeToSubscriptionChanges((next) => {
      setSubscriptionState(next);
    });
    return unsub;
  }, []);

  const persistReceipts = (updated: SavedReceipt[]) => {
    setReceipts(updated);
    saveReceiptsToDevice(updated).catch((err) =>
      console.error('Failed to persist receipts:', err)
    );
  };

  const saveBudgets = (nextBudgets: CategoryBudgets) => {
    setCategoryBudgets(nextBudgets);
    saveCategoryBudgets(nextBudgets);
  };

  const changeCurrency = (code: string) => {
    setPreferredCurrency(code);
    setCurrencyCode(code);
  };

  const toggleSunlightMode = () => setSunlightMode((prev) => !prev);

  return (
    <AppContext.Provider
      value={{
        receipts,
        setReceipts,
        persistReceipts,
        categoryBudgets,
        saveBudgets,
        subscriptionState,
        tier: subscriptionState.tier,
        currencyCode,
        changeCurrency,
        darkMode,
        setDarkMode,
        sunlightMode,
        setSunlightMode,
        toggleSunlightMode,
        clients,
        setClients,
        inventory,
        setInventory,
        quotes,
        setQuotes,
        invoices,
        setInvoices,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return ctx;
};
