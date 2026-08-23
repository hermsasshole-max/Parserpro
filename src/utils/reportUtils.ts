import { SavedReceipt, ReceiptCategory, AggregatedItem, ItemComparison, MonthReportData } from '../types';

/**
 * Standardizes item name for reliable grouping and alphabetical sorting
 */
export function normalizeItemName(name: string): string {
  if (!name) return 'Unspecified Item';
  const clean = name.trim().replace(/\s+/g, ' ');
  // Capitalize first letter of each major word for clean display
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Aggregates all line items from a list of receipts in a specific month
 * and sorts them alphabetically (A-Z).
 */
export function aggregateMonthItems(receipts: SavedReceipt[]): AggregatedItem[] {
  const itemMap = new Map<string, {
    name: string;
    total_quantity: number;
    total_amount: number;
    occurrences: number;
    categories: Set<ReceiptCategory>;
    receipt_ids: Set<string>;
  }>();

  receipts.forEach((receipt) => {
    receipt.line_items.forEach((item) => {
      const normalizedKey = item.description.trim().toLowerCase();
      const displayName = normalizeItemName(item.description);

      if (!itemMap.has(normalizedKey)) {
        itemMap.set(normalizedKey, {
          name: displayName,
          total_quantity: 0,
          total_amount: 0,
          occurrences: 0,
          categories: new Set<ReceiptCategory>(),
          receipt_ids: new Set<string>()
        });
      }

      const entry = itemMap.get(normalizedKey)!;
      entry.total_quantity += Number(item.quantity) || 1;
      entry.total_amount += Number(item.total_price) || (Number(item.quantity) * Number(item.unit_price)) || 0;
      entry.occurrences += 1;
      entry.categories.add(receipt.category);
      entry.receipt_ids.add(receipt.id);
    });
  });

  const result: AggregatedItem[] = Array.from(itemMap.values()).map((entry) => ({
    name: entry.name,
    total_quantity: Number(entry.total_quantity.toFixed(2)),
    total_amount: Number(entry.total_amount.toFixed(2)),
    average_unit_price: entry.total_quantity > 0 ? Number((entry.total_amount / entry.total_quantity).toFixed(2)) : 0,
    occurrences: entry.occurrences,
    categories: Array.from(entry.categories),
    receipt_ids: Array.from(entry.receipt_ids)
  }));

  // Sort strictly in alphabetical order
  result.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return result;
}

/**
 * Generates full monthly report metadata including category totals and alphabetical items
 */
export function generateMonthReport(monthYear: string, receipts: SavedReceipt[]): MonthReportData {
  const monthReceipts = receipts.filter(r => r.month_year === monthYear);
  
  const category_totals: Record<ReceiptCategory, number> = {
    'Food & Groceries': 0,
    'Electricity & Utilities': 0,
    'Home Maintenance': 0,
    'Transport': 0,
    'Other': 0
  };

  let total_spend = 0;

  monthReceipts.forEach(r => {
    const amount = Number(r.total_amount) || 0;
    total_spend += amount;
    if (category_totals[r.category] !== undefined) {
      category_totals[r.category] += amount;
    } else {
      category_totals['Other'] += amount;
    }
  });

  const items_alphabetical = aggregateMonthItems(monthReceipts);

  return {
    month_year: monthYear,
    total_spend: Number(total_spend.toFixed(2)),
    receipt_count: monthReceipts.length,
    item_count: items_alphabetical.length,
    category_totals: {
      'Food & Groceries': Number(category_totals['Food & Groceries'].toFixed(2)),
      'Electricity & Utilities': Number(category_totals['Electricity & Utilities'].toFixed(2)),
      'Home Maintenance': Number(category_totals['Home Maintenance'].toFixed(2)),
      'Transport': Number(category_totals['Transport'].toFixed(2)),
      'Other': Number(category_totals['Other'].toFixed(2)),
    },
    items_alphabetical
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
  reportA.items_alphabetical.forEach(item => {
    itemMapA.set(item.name.toLowerCase().trim(), item);
  });

  const itemMapB = new Map<string, AggregatedItem>();
  reportB.items_alphabetical.forEach(item => {
    itemMapB.set(item.name.toLowerCase().trim(), item);
  });

  // Collect all unique item keys across both months
  const allKeys = Array.from(new Set([...itemMapA.keys(), ...itemMapB.keys()]));

  const comparisonItems: ItemComparison[] = allKeys.map(key => {
    const itemA = itemMapA.get(key);
    const itemB = itemMapB.get(key);

    const name = itemA?.name || itemB?.name || key;
    const category = (itemA?.categories[0] || itemB?.categories[0] || 'Other') as ReceiptCategory;

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
      status
    };
  });

  // Sort strictly alphabetically by item name
  comparisonItems.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const totalA = reportA.total_spend;
  const totalB = reportB.total_spend;
  const totalDiff = Number((totalA - totalB).toFixed(2));
  const totalPercentChange = totalB > 0 ? Number((((totalA - totalB) / totalB) * 100).toFixed(1)) : 0;

  // Identify top savings (largest negative diff or not purchased)
  const topSavings = [...comparisonItems]
    .filter(i => i.amount_diff < 0)
    .sort((a, b) => a.amount_diff - b.amount_diff)
    .slice(0, 5);

  // Identify top increases (largest positive diff)
  const topIncreases = [...comparisonItems]
    .filter(i => i.amount_diff > 0)
    .sort((a, b) => b.amount_diff - a.amount_diff)
    .slice(0, 5);

  const categories: ReceiptCategory[] = [
    'Food & Groceries',
    'Electricity & Utilities',
    'Home Maintenance',
    'Transport',
    'Other'
  ];

  const categoryComparison = categories.map(cat => {
    const catA = reportA.category_totals[cat] || 0;
    const catB = reportB.category_totals[cat] || 0;
    return {
      category: cat,
      monthA: catA,
      monthB: catB,
      diff: Number((catA - catB).toFixed(2))
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
    categoryComparison
  };
}

/**
 * Exports data to CSV file download
 */
export function exportComparisonToCSV(
  monthA: string,
  monthB: string,
  items: ItemComparison[]
) {
  const headers = [
    'Item Name (Alphabetical)',
    'Category',
    `${monthA} Quantity`,
    `${monthA} Total (ZAR)`,
    `${monthB} Quantity`,
    `${monthB} Total (ZAR)`,
    'Difference (ZAR)',
    '% Change',
    'Trend / Status'
  ];

  const rows = items.map(item => [
    `"${item.name.replace(/"/g, '""')}"`,
    `"${item.category}"`,
    item.monthA_quantity,
    item.monthA_total.toFixed(2),
    item.monthB_quantity,
    item.monthB_total.toFixed(2),
    item.amount_diff.toFixed(2),
    `${item.percent_change}%`,
    item.status === 'spent_more' ? 'Spent More' :
    item.status === 'saved_more' ? 'Saved More' :
    item.status === 'new_item' ? 'New Item' :
    item.status === 'not_purchased' ? 'Not Purchased (Saved)' : 'Unchanged'
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Expenditure_Report_${monthA}_vs_${monthB}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates a clean, printable Markdown report for any single or multiple months
 */
export function generateMonthlyMarkdownReport(monthYear: string, receipts: SavedReceipt[]): string {
  const report = generateMonthReport(monthYear, receipts);
  const monthReceipts = receipts.filter(r => r.month_year === monthYear);

  let md = `# 📊 Monthly Accounting & Expenditure Report: ${monthYear}\n\n`;
  md += `**Generated Date:** ${new Date().toLocaleDateString('en-ZA')}\n`;
  md += `**Total Invoices/Receipts Filed:** ${report.receipt_count}\n`;
  md += `**Overall Grand Total:** R ${report.total_spend.toFixed(2)}\n\n`;

  md += `## 🏢 Invoice Register\n\n`;
  md += `| Date | Vendor / Provider | Category | Total (ZAR) |\n`;
  md += `| :--- | :--- | :--- | ---: |\n`;
  monthReceipts.forEach(r => {
    md += `| ${r.invoice_date} | ${r.vendor_name} | ${r.category} | R ${r.total_amount.toFixed(2)} |\n`;
  });
  md += `| **GRAND TOTAL** | | | **R ${report.total_spend.toFixed(2)}** |\n\n`;

  md += `## 📦 Merged Item-by-Item Summary (A-Z)\n\n`;
  md += `> *Identical and similar item descriptions have been unified with summed quantities and aggregated costs.*\n\n`;
  md += `| Item Description | Category | Total Quantity | Unit Avg Price | Total Cost (ZAR) |\n`;
  md += `| :--- | :--- | :---: | ---: | ---: |\n`;
  report.items_alphabetical.forEach(item => {
    md += `| ${item.name} | ${item.categories.join(', ')} | ${item.total_quantity} | R ${item.average_unit_price.toFixed(2)} | R ${item.total_amount.toFixed(2)} |\n`;
  });
  md += `| **MONTHLY TOTAL** | | | | **R ${report.total_spend.toFixed(2)}** |\n\n`;

  md += `## 📈 Category Summary\n\n`;
  md += `| Category | Total Spend (ZAR) | % of Budget |\n`;
  md += `| :--- | ---: | ---: |\n`;
  Object.entries(report.category_totals).forEach(([cat, amount]) => {
    const pct = report.total_spend > 0 ? ((amount / report.total_spend) * 100).toFixed(1) : '0.0';
    md += `| ${cat} | R ${amount.toFixed(2)} | ${pct}% |\n`;
  });
  md += `\n---\n`;

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
