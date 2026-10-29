export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  annualMonthlyEquivalent: string;
  lifetimePrice: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  {
    code: 'ZAR',
    symbol: 'R',
    name: 'South African Rand (R)',
    monthlyPrice: 'R 49.99',
    annualPrice: 'R 399.99',
    annualMonthlyEquivalent: 'R 33.33',
    lifetimePrice: 'R 799.99',
  },
  {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar ($)',
    monthlyPrice: '$2.99',
    annualPrice: '$24.99',
    annualMonthlyEquivalent: '$2.08',
    lifetimePrice: '$49.99',
  },
  {
    code: 'EUR',
    symbol: '€',
    name: 'Euro (€)',
    monthlyPrice: '€2.99',
    annualPrice: '€24.99',
    annualMonthlyEquivalent: '€2.08',
    lifetimePrice: '€49.99',
  },
  {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound (£)',
    monthlyPrice: '£2.49',
    annualPrice: '£19.99',
    annualMonthlyEquivalent: '£1.67',
    lifetimePrice: '£39.99',
  },
  {
    code: 'AUD',
    symbol: 'A$',
    name: 'Australian Dollar (A$)',
    monthlyPrice: 'A$4.49',
    annualPrice: 'A$34.99',
    annualMonthlyEquivalent: 'A$2.92',
    lifetimePrice: 'A$69.99',
  },
  {
    code: 'CAD',
    symbol: 'C$',
    name: 'Canadian Dollar (C$)',
    monthlyPrice: 'C$3.99',
    annualPrice: 'C$29.99',
    annualMonthlyEquivalent: 'C$2.50',
    lifetimePrice: 'C$59.99',
  },
  {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee (₹)',
    monthlyPrice: '₹199',
    annualPrice: '₹1,499',
    annualMonthlyEquivalent: '₹125',
    lifetimePrice: '₹2,999',
  },
  {
    code: 'BRL',
    symbol: 'R$',
    name: 'Brazilian Real (R$)',
    monthlyPrice: 'R$ 14,90',
    annualPrice: 'R$ 119,90',
    annualMonthlyEquivalent: 'R$ 9,99',
    lifetimePrice: 'R$ 229,90',
  },
  {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen (¥)',
    monthlyPrice: '¥450',
    annualPrice: '¥3,600',
    annualMonthlyEquivalent: '¥300',
    lifetimePrice: '¥7,200',
  },
];

const PREFERRED_CURRENCY_KEY = 'parserpro_preferred_currency_v1';

export function detectDefaultCurrency(): string {
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      const lang = navigator.language.toLowerCase();
      if (lang.includes('za') || lang.startsWith('af') || lang.startsWith('zu')) return 'ZAR';
      if (lang.includes('gb')) return 'GBP';
      if (lang.includes('au')) return 'AUD';
      if (lang.includes('ca')) return 'CAD';
      if (lang.includes('in') || lang.startsWith('hi')) return 'INR';
      if (lang.includes('br')) return 'BRL';
      if (lang.startsWith('ja')) return 'JPY';
      if (
        lang.startsWith('de') ||
        lang.startsWith('fr') ||
        lang.startsWith('es') ||
        lang.startsWith('it') ||
        lang.startsWith('nl') ||
        lang.includes('pt')
      ) {
        return 'EUR';
      }
      if (lang.includes('us')) return 'USD';
    }
  } catch {
    // Fallback below
  }
  return 'ZAR';
}

export function getPreferredCurrency(): string {
  try {
    const saved = localStorage.getItem(PREFERRED_CURRENCY_KEY);
    if (saved && SUPPORTED_CURRENCIES.some((c) => c.code === saved)) {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }
  return detectDefaultCurrency();
}

export function setPreferredCurrency(code: string): void {
  try {
    const normalized = code.trim().toUpperCase();
    localStorage.setItem(PREFERRED_CURRENCY_KEY, normalized);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('parserpro-currency-changed', { detail: normalized }));
    }
  } catch (e) {
    console.warn('[Currency] Could not persist preferred currency:', e);
  }
}

export function getCurrencyOption(code?: string): CurrencyOption {
  const target = (code || getPreferredCurrency()).toUpperCase();
  return SUPPORTED_CURRENCIES.find((c) => c.code === target) || SUPPORTED_CURRENCIES[0];
}

export function getCurrencySymbol(code?: string): string {
  return getCurrencyOption(code).symbol;
}

export function formatMoney(amount: number, currencyOverride?: string): string {
  const opt = getCurrencyOption(currencyOverride);
  const safeNum = Number.isFinite(amount) ? amount : 0;
  const decimals = opt.code === 'JPY' ? 0 : 2;
  const formatted = Math.abs(safeNum).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = safeNum < 0 ? '-' : '';
  const spacer = opt.symbol.length > 1 || opt.symbol === 'R' ? ' ' : '';
  return `${sign}${opt.symbol}${spacer}${formatted}`;
}

export function formatMonthLabel(monthYear: string): string {
  if (!monthYear || !/^\d{4}-\d{2}$/.test(monthYear)) {
    return monthYear || 'Current Month';
  }
  const [yearStr, monthStr] = monthYear.split('-');
  const year = Number(yearStr);
  const monthIdx = Number(monthStr) - 1;
  const date = new Date(year, monthIdx, 1);
  if (Number.isNaN(date.getTime())) return monthYear;
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

export function formatShortDate(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return isoDate;
  }
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return isoDate;
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function normalizeReceiptCategory(
  raw?: string,
  fallback: import('../types').ReceiptCategory = 'Food & Groceries'
): import('../types').ReceiptCategory {
  if (!raw) return fallback;
  const val = raw.trim().toLowerCase();
  if (
    val === 'food & groceries' ||
    val.includes('grocer') ||
    val.includes('food') ||
    val.includes('supermarket') ||
    val.includes('bakery') ||
    val.includes('butcher')
  ) {
    return 'Food & Groceries';
  }
  if (
    val === 'electricity & utilities' ||
    val.includes('utilit') ||
    val.includes('electric') ||
    val.includes('water') ||
    val.includes('municipal') ||
    val.includes('power')
  ) {
    return 'Electricity & Utilities';
  }
  if (
    val === 'home maintenance' ||
    val.includes('hardware') ||
    val.includes('home') ||
    val.includes('diy') ||
    val.includes('maintenance') ||
    val.includes('garden') ||
    val.includes('plumb')
  ) {
    return 'Home Maintenance';
  }
  if (
    val === 'transport' ||
    val.includes('fuel') ||
    val.includes('petrol') ||
    val.includes('diesel') ||
    val.includes('transport') ||
    val.includes('parking') ||
    val.includes('toll')
  ) {
    return 'Transport';
  }
  if (val === 'other') {
    return 'Other';
  }
  return fallback;
}

export function formatCategoryLabel(category: import('../types').ReceiptCategory | string): string {
  if (category === 'Home Maintenance') {
    return 'Hardware & Home Maintenance';
  }
  return category || 'Other';
}

export function formatPriceVarianceSummary(
  lowest: number,
  highest: number,
  currencyOverride?: string
): string {
  const safeLow = Number.isFinite(lowest) ? lowest : 0;
  const safeHigh = Number.isFinite(highest) ? highest : safeLow;
  const spread = Math.max(0, Number((safeHigh - safeLow).toFixed(2)));
  const lowStr = formatMoney(safeLow, currencyOverride);
  const highStr = formatMoney(safeHigh, currencyOverride);
  const spreadStr = formatMoney(spread, currencyOverride);

  if (spread > 0.004) {
    return `${lowStr} – ${highStr} (+${spreadStr} variance)`;
  }
  return `${lowStr} – ${highStr} (${spreadStr} variance)`;
}

