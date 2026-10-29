import {
  SavedReceipt,
  ReceiptCategory,
  AggregatedItem,
  ItemComparison,
  MonthReportData,
  ItemPriceObservation,
  CategorySummaryRow,
} from '../types';
import {
  normalizeReceiptCategory,
  formatCategoryLabel,
  formatMoney,
  formatPriceVarianceSummary,
} from './currencyFormat';
import { getDisplayInvoiceNumber } from './duplicateDetection';

const ALL_CATEGORIES: ReceiptCategory[] = [
  'Food & Groceries',
  'Electricity & Utilities',
  'Home Maintenance',
  'Transport',
  'Other',
];

/**
 * Produces a canonical lookup key so identical items across thermal receipts
 * (e.g. "WHITE BREAD 700G", "White Bread 700g", "00412 White Bread 700g") merge cleanly.
 */
export function canonicalizeItemKey(rawName: string): string {
  if (!rawName) return 'unspecified item';
  return rawName
    .trim()
    .replace(/^\d{4,14}\s+(?=[A-Za-z])/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Standardizes item name for clean human display and alphabetical sorting.
 * Converts ALL-CAPS thermal slip text to readable Title Case while preserving unit suffixes (700g, 2L, 500ml).
 */
export function normalizeItemName(name: string): string {
  if (!name) return 'Unspecified Item';
  const clean = name
    .trim()
    .replace(/^\d{4,14}\s+(?=[A-Za-z])/, '')
    .replace(/\s+/g, ' ');
  if (!clean) return 'Unspecified Item';

  const letters = clean.replace(/[^A-Za-z]/g, '');
  const isAllCaps = letters.length > 2 && letters === letters.toUpperCase();

  if (isAllCaps) {
    return clean
      .split(' ')
      .map((word) => {
        if (/^\d+(?:[.,]\d+)?(?:G|KG|MG|ML|L|PK|PC|PCS|W|KW|KWH)$/i.test(word)) {
          return word.replace(/L$/i, 'L').replace(/(G|KG|MG|ML|PK|PC|PCS)$/i, (m) => m.toLowerCase());
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Aggregates all line items from a list of receipts in a specific billing period/month:
 * - Groups identical items across all scanned receipts
 * - Tracks total purchase occurrences (e.g. "Bread: Purchased 5 times")
 * - Tracks lowest, highest, and most recent unit price paid + unit price variance
 * - Sorts alphabetically (A-Z) by default
 */
export function aggregateMonthItems(receipts: SavedReceipt[]): AggregatedItem[] {
  // Sort receipts chronologically so the final observation is strictly the most recent unit price paid
  const chronologicalReceipts = [...receipts].sort((a, b) => {
    const dateCmp = (a.invoice_date || '').localeCompare(b.invoice_date || '');
    if (dateCmp !== 0) return dateCmp;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });

  const itemMap = new Map<
    string,
    {
      name: string;
      total_quantity: number;
      total_amount: number;
      occurrences: number;
      categoryCounts: Map<ReceiptCategory, number>;
      categories: Set<ReceiptCategory>;
      receipt_ids: Set<string>;
      observations: ItemPriceObservation[];
    }
  >();

  chronologicalReceipts.forEach((receipt) => {
    const receiptCategory = normalizeReceiptCategory(receipt.category, 'Other');
    const displayInv = getDisplayInvoiceNumber(receipt);

    (receipt.line_items || []).forEach((item) => {
      if (!item || !item.description || !item.description.trim()) return;

      const normalizedKey = canonicalizeItemKey(item.description);
      const displayName = normalizeItemName(item.description);
      const itemCategory = normalizeReceiptCategory(item.category, receiptCategory);

      const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
      const rawUnit = Number(item.unit_price) || 0;
      const rawTotal = Number(item.total_price) || 0;
      const lineTotal = rawTotal > 0 ? rawTotal : Number((qty * rawUnit).toFixed(2));
      const unitPrice =
        rawUnit > 0
          ? Number(rawUnit.toFixed(2))
          : qty > 0 && lineTotal > 0
          ? Number((lineTotal / qty).toFixed(2))
          : 0;

      if (!itemMap.has(normalizedKey)) {
        itemMap.set(normalizedKey, {
          name: displayName,
          total_quantity: 0,
          total_amount: 0,
          occurrences: 0,
          categoryCounts: new Map<ReceiptCategory, number>(),
          categories: new Set<ReceiptCategory>(),
          receipt_ids: new Set<string>(),
          observations: [],
        });
      }

      const entry = itemMap.get(normalizedKey)!;
      entry.total_quantity += qty;
      entry.total_amount += lineTotal;
      entry.occurrences += 1;
      entry.categories.add(itemCategory);
      entry.categoryCounts.set(itemCategory, (entry.categoryCounts.get(itemCategory) || 0) + 1);
      entry.receipt_ids.add(receipt.id);

      entry.observations.push({
        receipt_id: receipt.id,
        invoice_date: receipt.invoice_date,
        vendor_name: receipt.vendor_name,
        invoice_number: displayInv || undefined,
        category: itemCategory,
        quantity: Number(qty.toFixed(2)),
        unit_price: unitPrice,
        total_price: Number(lineTotal.toFixed(2)),
      });
    });
  });

  const result: AggregatedItem[] = Array.from(itemMap.values()).map((entry) => {
    const positiveUnitPrices = entry.observations
      .map((o) => o.unit_price)
      .filter((p) => Number.isFinite(p) && p > 0);

    const avgUnitPrice =
      entry.total_quantity > 0
        ? Number((entry.total_amount / entry.total_quantity).toFixed(2))
        : 0;

    const lowestUnit =
      positiveUnitPrices.length > 0 ? Math.min(...positiveUnitPrices) : avgUnitPrice;
    const highestUnit =
      positiveUnitPrices.length > 0 ? Math.max(...positiveUnitPrices) : avgUnitPrice;

    const latestObs = entry.observations[entry.observations.length - 1];
    const latestUnit =
      latestObs && latestObs.unit_price > 0 ? latestObs.unit_price : avgUnitPrice;

    let primaryCategory: ReceiptCategory = 'Food & Groceries';
    let maxCatCount = -1;
    entry.categoryCounts.forEach((count, cat) => {
      if (count > maxCatCount) {
        maxCatCount = count;
        primaryCategory = cat;
      }
    });

    const variance = Math.max(0, Number((highestUnit - lowestUnit).toFixed(2)));

    return {
      name: entry.name,
      primary_category: primaryCategory,
      total_quantity: Number(entry.total_quantity.toFixed(2)),
      total_amount: Number(entry.total_amount.toFixed(2)),
      average_unit_price: avgUnitPrice,
      lowest_unit_price: Number(lowestUnit.toFixed(2)),
      highest_unit_price: Number(highestUnit.toFixed(2)),
      latest_unit_price: Number(latestUnit.toFixed(2)),
      latest_purchase_date: latestObs?.invoice_date || '',
      latest_vendor: latestObs?.vendor_name || '',
      price_variance: variance,
      occurrences: entry.occurrences,
      categories: Array.from(entry.categories),
      receipt_ids: Array.from(entry.receipt_ids),
      price_history: entry.observations,
    };
  });

  // Sort strictly in alphabetical order
  result.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return result;
}

/**
 * Generates full monthly report metadata including per-category subtotals (supporting mixed-category slips)
 * and grouped item frequency & price variance statistics.
 */
export function generateMonthReport(monthYear: string, receipts: SavedReceipt[]): MonthReportData {
  const monthReceipts = receipts.filter((r) => r.month_year === monthYear);

  const category_totals: Record<ReceiptCategory, number> = {
    'Food & Groceries': 0,
    'Electricity & Utilities': 0,
    'Home Maintenance': 0,
    'Transport': 0,
    'Other': 0,
  };

  const categoryReceiptSets: Record<ReceiptCategory, Set<string>> = {
    'Food & Groceries': new Set(),
    'Electricity & Utilities': new Set(),
    'Home Maintenance': new Set(),
    'Transport': new Set(),
    'Other': new Set(),
  };

  const categoryItemCounts: Record<ReceiptCategory, number> = {
    'Food & Groceries': 0,
    'Electricity & Utilities': 0,
    'Home Maintenance': 0,
    'Transport': 0,
    'Other': 0,
  };

  let total_spend = 0;

  monthReceipts.forEach((r) => {
    const receiptTotal = Number(r.total_amount) || 0;
    total_spend += receiptTotal;
    const fallbackCat = normalizeReceiptCategory(r.category, 'Other');
    const items = r.line_items || [];

    if (items.length === 0) {
      category_totals[fallbackCat] += receiptTotal;
      categoryReceiptSets[fallbackCat].add(r.id);
      return;
    }

    let itemsSum = 0;
    const rawCatAllocations = new Map<ReceiptCategory, number>();

    items.forEach((item) => {
      const itemCat = normalizeReceiptCategory(item.category, fallbackCat);
      const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
      const lineTotal =
        Number(item.total_price) > 0
          ? Number(item.total_price)
          : Number((qty * (Number(item.unit_price) || 0)).toFixed(2));

      itemsSum += lineTotal;
      rawCatAllocations.set(itemCat, (rawCatAllocations.get(itemCat) || 0) + lineTotal);
      categoryReceiptSets[itemCat].add(r.id);
      categoryItemCounts[itemCat] += 1;
    });

    if (itemsSum <= 0) {
      category_totals[fallbackCat] += receiptTotal;
      categoryReceiptSets[fallbackCat].add(r.id);
    } else if (Math.abs(receiptTotal - itemsSum) <= 0.02) {
      rawCatAllocations.forEach((val, cat) => {
        category_totals[cat] += val;
      });
      // Snap rounding delta to fallback category
      category_totals[fallbackCat] += receiptTotal - itemsSum;
    } else if (receiptTotal > itemsSum) {
      // Allocate un-itemized tax/rounding remainder to the receipt's primary category
      rawCatAllocations.forEach((val, cat) => {
        category_totals[cat] += val;
      });
      category_totals[fallbackCat] += receiptTotal - itemsSum;
      categoryReceiptSets[fallbackCat].add(r.id);
    } else {
      // Scale proportionally when receipt total includes loyalty/basket discounts below line-item sum
      const scale = receiptTotal / itemsSum;
      rawCatAllocations.forEach((val, cat) => {
        category_totals[cat] += val * scale;
      });
    }
  });

  const items_alphabetical = aggregateMonthItems(monthReceipts);
  const total_item_purchases = items_alphabetical.reduce((sum, it) => sum + it.occurrences, 0);
  const roundedTotalSpend = Number(total_spend.toFixed(2));

  const roundedCategoryTotals: Record<ReceiptCategory, number> = {
    'Food & Groceries': Number(Math.max(0, category_totals['Food & Groceries']).toFixed(2)),
    'Electricity & Utilities': Number(
      Math.max(0, category_totals['Electricity & Utilities']).toFixed(2)
    ),
    'Home Maintenance': Number(Math.max(0, category_totals['Home Maintenance']).toFixed(2)),
    'Transport': Number(Math.max(0, category_totals['Transport']).toFixed(2)),
    'Other': Number(Math.max(0, category_totals['Other']).toFixed(2)),
  };

  const category_breakdown: CategorySummaryRow[] = ALL_CATEGORIES.map((category) => {
    const subtotal = roundedCategoryTotals[category];
    const percentage =
      roundedTotalSpend > 0 ? Number(((subtotal / roundedTotalSpend) * 100).toFixed(1)) : 0;
    return {
      category,
      subtotal,
      percentage,
      receipt_count: categoryReceiptSets[category].size,
      item_count: categoryItemCounts[category],
    };
  }).sort((a, b) => b.subtotal - a.subtotal);

  return {
    month_year: monthYear,
    total_spend: roundedTotalSpend,
    receipt_count: monthReceipts.length,
    item_count: items_alphabetical.length,
    total_item_purchases,
    category_totals: roundedCategoryTotals,
    category_breakdown,
    items_alphabetical,
  };
}

/**
 * Compares two months item-by-item in alphabetical order
 * Returns detailed comparison showing where more was spent and where more was saved
 */
export function compareMonths(
  monthA: string,
  monthB: string,
  receipts: SavedReceipt[]
): {
  items: ItemComparison[];
  totalA: number;
  totalB: number;
  totalDiff: number;
  totalPercentChange: number;
  topSavings: ItemComparison[];
  topIncreases: ItemComparison[];
  categoryComparison: {
    category: ReceiptCategory;
    monthA: number;
    monthB: number;
    diff: number;
  }[];
} {
  const reportA = generateMonthReport(monthA, receipts);
  const reportB = generateMonthReport(monthB, receipts);

  const itemMapA = new Map<string, AggregatedItem>();
  reportA.items_alphabetical.forEach((item) => {
    itemMapA.set(canonicalizeItemKey(item.name), item);
  });

  const itemMapB = new Map<string, AggregatedItem>();
  reportB.items_alphabetical.forEach((item) => {
    itemMapB.set(canonicalizeItemKey(item.name), item);
  });

  // Collect all unique item keys across both months
  const allKeys = Array.from(new Set([...itemMapA.keys(), ...itemMapB.keys()]));

  const comparisonItems: ItemComparison[] = allKeys.map((key) => {
    const itemA = itemMapA.get(key);
    const itemB = itemMapB.get(key);

    const name = itemA?.name || itemB?.name || key;
    const category = (itemA?.primary_category ||
      itemB?.primary_category ||
      itemA?.categories[0] ||
      itemB?.categories[0] ||
      'Other') as ReceiptCategory;

    const totalA = itemA?.total_amount || 0;
    const qtyA = itemA?.total_quantity || 0;
    const totalB = itemB?.total_amount || 0;
    const qtyB = itemB?.total_quantity || 0;

    const amount_diff = Number((totalA - totalB).toFixed(2));
    const qty_diff = Number((qtyA - qtyB).toFixed(2));

    let percent_change = 0;
    if (totalB > 0) {
      percent_change = Number((((totalA - totalB) / totalB) * 100).toFixed(1));
    } else if (totalA > 0) {
      percent_change = 100;
    }

    let status: ItemComparison['status'] = 'unchanged';
    if (!itemB && itemA) {
      status = 'new_item';
    } else if (itemB && !itemA) {
      status = 'not_purchased'; // saved 100% on this item
    } else if (amount_diff > 0.01) {
      status = 'spent_more';
    } else if (amount_diff < -0.01) {
      status = 'saved_more';
    }

    return {
      name,
      category,
      monthA_quantity: qtyA,
      monthA_total: totalA,
      monthB_quantity: qtyB,
      monthB_total: totalB,
      amount_diff,
      qty_diff,
      percent_change,
      status,
    };
  });

  // Sort strictly alphabetically by item name
  comparisonItems.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const totalA = reportA.total_spend;
  const totalB = reportB.total_spend;
  const totalDiff = Number((totalA - totalB).toFixed(2));
  const totalPercentChange =
    totalB > 0 ? Number((((totalA - totalB) / totalB) * 100).toFixed(1)) : 0;

  // Identify top savings (largest negative diff or not purchased)
  const topSavings = [...comparisonItems]
    .filter((i) => i.amount_diff < 0)
    .sort((a, b) => a.amount_diff - b.amount_diff)
    .slice(0, 5);

  // Identify top increases (largest positive diff)
  const topIncreases = [...comparisonItems]
    .filter((i) => i.amount_diff > 0)
    .sort((a, b) => b.amount_diff - a.amount_diff)
    .slice(0, 5);

  const categoryComparison = ALL_CATEGORIES.map((cat) => {
    const catA = reportA.category_totals[cat] || 0;
    const catB = reportB.category_totals[cat] || 0;
    return {
      category: cat,
      monthA: catA,
      monthB: catB,
      diff: Number((catA - catB).toFixed(2)),
    };
  });

  return {
    items: comparisonItems,
    totalA,
    totalB,
    totalDiff,
    totalPercentChange,
    topSavings,
    topIncreases,
    categoryComparison,
  };
}

/**
 * Exports single-month aggregated item frequency, unit price variance, and category subtotals to CSV
 */
export function exportMonthlySummaryToCSV(
  monthYear: string,
  receipts: SavedReceipt[],
  currencyCode = 'ZAR'
) {
  const report = generateMonthReport(monthYear, receipts);

  const itemHeaders = [
    'Item Name',
    'Assigned Category',
    'Purchase Frequency',
    'Times Purchased',
    'Total Quantity',
    `Lowest Unit Price (${currencyCode})`,
    `Highest Unit Price (${currencyCode})`,
    `Most Recent Unit Price (${currencyCode})`,
    `Unit Price Variance (${currencyCode})`,
    'Price History & Variance Summary',
    'Most Recent Purchase Date',
    `Item Total Expenditure (${currencyCode})`,
  ];

  const itemRows = report.items_alphabetical.map((item) => [
    `"${item.name.replace(/"/g, '""')}"`,
    `"${formatCategoryLabel(item.primary_category)}"`,
    `"Purchased ${item.occurrences} ${item.occurrences === 1 ? 'time' : 'times'}"`,
    item.occurrences,
    item.total_quantity,
    item.lowest_unit_price.toFixed(2),
    item.highest_unit_price.toFixed(2),
    item.latest_unit_price.toFixed(2),
    item.price_variance.toFixed(2),
    `"${formatPriceVarianceSummary(item.lowest_unit_price, item.highest_unit_price, currencyCode)}"`,
    `"${item.latest_purchase_date}"`,
    item.total_amount.toFixed(2),
  ]);

  const catHeaders = [
    'Category Breakdown',
    `Subtotal (${currencyCode})`,
    '% of Monthly Spend',
    'Receipts Count',
    'Line Items Count',
  ];

  const catRows = report.category_breakdown.map((row) => [
    `"${formatCategoryLabel(row.category)}"`,
    row.subtotal.toFixed(2),
    `${row.percentage}%`,
    row.receipt_count,
    row.item_count,
  ]);

  const csvLines = [
    `Monthly Aggregation & Price Variance Summary (${monthYear})`,
    `Total Receipts,${report.receipt_count},Unique Items,${report.item_count},TotalSpend,${report.total_spend.toFixed(2)}`,
    '',
    catHeaders.join(','),
    ...catRows.map((r) => r.join(',')),
    `"TOTAL EXPENDITURE",${report.total_spend.toFixed(2)},100%,,`,
    '',
    itemHeaders.join(','),
    ...itemRows.map((r) => r.join(',')),
  ];

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Monthly_Aggregation_${monthYear}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Exports month-to-month comparison data to CSV file download
 */
export function exportComparisonToCSV(
  monthA: string,
  monthB: string,
  items: ItemComparison[],
  currencyCode = 'ZAR'
) {
  const headers = [
    'Item Name (Alphabetical)',
    'Category',
    `${monthA} Quantity`,
    `${monthA} Total (${currencyCode})`,
    `${monthB} Quantity`,
    `${monthB} Total (${currencyCode})`,
    `Difference (${currencyCode})`,
    '% Change',
    'Trend / Status',
  ];

  const rows = items.map((item) => [
    `"${item.name.replace(/"/g, '""')}"`,
    `"${formatCategoryLabel(item.category)}"`,
    item.monthA_quantity,
    item.monthA_total.toFixed(2),
    item.monthB_quantity,
    item.monthB_total.toFixed(2),
    item.amount_diff.toFixed(2),
    `${item.percent_change}%`,
    item.status === 'spent_more'
      ? 'Spent More'
      : item.status === 'saved_more'
      ? 'Saved More'
      : item.status === 'new_item'
      ? 'New Item'
      : item.status === 'not_purchased'
      ? 'Not Purchased (Saved)'
      : 'Unchanged',
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Expenditure_Report_${monthA}_vs_${monthB}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Generates a clean, printable Markdown report for any single month
 */
export function generateMonthlyMarkdownReport(
  monthYear: string,
  receipts: SavedReceipt[],
  currencyCode = 'ZAR'
): string {
  const report = generateMonthReport(monthYear, receipts);
  const monthReceipts = receipts.filter((r) => r.month_year === monthYear);

  let md = `# Monthly Financial Aggregation & Variance Report: ${monthYear}\n\n`;
  md += `**Generated Date:** ${new Date().toLocaleDateString('en-ZA')}\n`;
  md += `**Total Receipts Filed:** ${report.receipt_count}\n`;
  md += `**Overall Monthly Total:** ${formatMoney(report.total_spend, currencyCode)}\n\n`;

  md += `## Category Breakdown\n\n`;
  md += `| Category | Subtotal | % of Monthly Spend |\n`;
  md += `| :--- | ---: | ---: |\n`;
  report.category_breakdown.forEach((row) => {
    md += `| ${formatCategoryLabel(row.category)} | ${formatMoney(row.subtotal, currencyCode)} | ${row.percentage.toFixed(1)}% |\n`;
  });
  md += `| **GRAND TOTAL** | **${formatMoney(report.total_spend, currencyCode)}** | **100.0%** |\n\n`;

  md += `## Grouped Item Purchase Frequency & Price Variance (A-Z)\n\n`;
  md += `| Item | Category | Purchase Frequency | Price History & Variance (Low – High) | Most Recent Unit Price | Item Subtotal |\n`;
  md += `| :--- | :--- | :--- | :--- | ---: | ---: |\n`;
  report.items_alphabetical.forEach((item) => {
    const freqLabel = `Purchased ${item.occurrences} ${item.occurrences === 1 ? 'time' : 'times'}`;
    const varianceLabel = formatPriceVarianceSummary(
      item.lowest_unit_price,
      item.highest_unit_price,
      currencyCode
    );
    md += `| ${item.name} | ${formatCategoryLabel(item.primary_category)} | ${freqLabel} | ${varianceLabel} | ${formatMoney(item.latest_unit_price, currencyCode)} | ${formatMoney(item.total_amount, currencyCode)} |\n`;
  });
  md += `\n`;

  md += `## Receipt & Invoice Register\n\n`;
  md += `| Date | Store / Provider | Invoice # | Category | Total |\n`;
  md += `| :--- | :--- | :--- | :--- | ---: |\n`;
  monthReceipts.forEach((r) => {
    const inv = getDisplayInvoiceNumber(r) || '—';
    md += `| ${r.invoice_date} | ${r.vendor_name} | ${inv} | ${formatCategoryLabel(r.category)} | ${formatMoney(r.total_amount, currencyCode)} |\n`;
  });

  return md;
}

export function exportMarkdownReport(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export interface MonthSpendingTrendPoint {
  monthKey: string; // e.g. "2026-09"
  shortLabel: string; // e.g. "Sep '26"
  fullLabel: string; // e.g. "September 2026"
  totalSpend: number;
  receiptCount: number;
  itemCount: number;
  groceries: number;
  utilities: number;
  transport: number;
  home: number;
  other: number;
  topCategory: string;
}

export interface SixMonthSpendingTrendSummary {
  points: MonthSpendingTrendPoint[];
  totalSixMonthSpend: number;
  averageMonthlySpend: number;
  highestMonth: MonthSpendingTrendPoint;
  lowestMonth: MonthSpendingTrendPoint;
  percentChangeLatestVsPrev: number;
  percentChangeLatestVsAvg: number;
  activeMonthsCount: number;
}

/**
 * Calculates a rolling 6-month spending timeline with category breakouts and statistical variance
 */
export function calculateSixMonthSpendingTrend(
  receipts: SavedReceipt[],
  preferredEndMonth?: string
): SixMonthSpendingTrendSummary {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let endMonth = preferredEndMonth || currentMonthKey;
  if (receipts.length > 0) {
    const allMonths = receipts.map((r) => r.month_year).filter(Boolean);
    const maxReceiptMonth = allMonths.reduce((max, m) => (m > max ? m : max), '');
    if (maxReceiptMonth && maxReceiptMonth > endMonth) {
      endMonth = maxReceiptMonth;
    }
  }

  const [endYear, endMonthNum] = endMonth.split('-').map(Number);
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(endYear, endMonthNum - 1 - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    monthKeys.push(`${y}-${m}`);
  }

  const monthNamesShort = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const monthNamesFull = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const points: MonthSpendingTrendPoint[] = monthKeys.map((key) => {
    const [yStr, mStr] = key.split('-');
    const mIndex = parseInt(mStr, 10) - 1;
    const yearShort = yStr.slice(-2);
    const shortLabel = `${monthNamesShort[mIndex]} '${yearShort}`;
    const fullLabel = `${monthNamesFull[mIndex]} ${yStr}`;

    const monthReport = generateMonthReport(key, receipts);
    const groceries = monthReport.category_totals['Food & Groceries'] || 0;
    const utilities = monthReport.category_totals['Electricity & Utilities'] || 0;
    const transport = monthReport.category_totals['Transport'] || 0;
    const home = monthReport.category_totals['Home Maintenance'] || 0;
    const other = monthReport.category_totals['Other'] || 0;

    const topRow = monthReport.category_breakdown[0];
    const topCategory = topRow && topRow.subtotal > 0 ? topRow.category : 'None';

    return {
      monthKey: key,
      shortLabel,
      fullLabel,
      totalSpend: monthReport.total_spend,
      receiptCount: monthReport.receipt_count,
      itemCount: monthReport.total_item_purchases,
      groceries,
      utilities,
      transport,
      home,
      other,
      topCategory,
    };
  });

  const totalSixMonthSpend = points.reduce((acc, p) => acc + p.totalSpend, 0);
  const activeMonths = points.filter((p) => p.receiptCount > 0);
  const activeMonthsCount = activeMonths.length;
  const averageMonthlySpend = points.length > 0 ? totalSixMonthSpend / points.length : 0;

  let highestMonth = points[0];
  let lowestMonth = points[0];
  points.forEach((p) => {
    if (p.totalSpend > highestMonth.totalSpend) highestMonth = p;
    if (p.totalSpend < lowestMonth.totalSpend) lowestMonth = p;
  });

  const latestMonth = points[points.length - 1];
  const prevMonth = points[points.length - 2];
  const percentChangeLatestVsPrev =
    prevMonth && prevMonth.totalSpend > 0
      ? Number(
          (((latestMonth.totalSpend - prevMonth.totalSpend) / prevMonth.totalSpend) * 100).toFixed(
            1
          )
        )
      : 0;

  const percentChangeLatestVsAvg =
    averageMonthlySpend > 0
      ? Number(
          (((latestMonth.totalSpend - averageMonthlySpend) / averageMonthlySpend) * 100).toFixed(1)
        )
      : 0;

  return {
    points,
    totalSixMonthSpend: Number(totalSixMonthSpend.toFixed(2)),
    averageMonthlySpend: Number(averageMonthlySpend.toFixed(2)),
    highestMonth,
    lowestMonth,
    percentChangeLatestVsPrev,
    percentChangeLatestVsAvg,
    activeMonthsCount,
  };
}
