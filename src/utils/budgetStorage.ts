import type { ReceiptCategory, CategoryBudgets, CategoryBudgetProgress } from '../types';

export const CATEGORY_BUDGETS_STORAGE_KEY = 'parserpro_category_budgets_v1';

export const ALL_RECEIPT_CATEGORIES: ReceiptCategory[] = [
  'Food & Groceries',
  'Electricity & Utilities',
  'Home Maintenance',
  'Transport',
  'Other',
];

export const DEFAULT_CATEGORY_BUDGETS: CategoryBudgets = {
  'Food & Groceries': 0,
  'Electricity & Utilities': 0,
  'Home Maintenance': 0,
  'Transport': 0,
  'Other': 0,
};

/**
 * Loads monthly spending budget limits per category from localStorage.
 * Starts clean at 0 across all categories on new installations until configured by the user.
 */
export function loadCategoryBudgets(): CategoryBudgets {
  try {
    const raw = localStorage.getItem(CATEGORY_BUDGETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const validated: CategoryBudgets = { ...DEFAULT_CATEGORY_BUDGETS };
        for (const cat of ALL_RECEIPT_CATEGORIES) {
          const val = Number(parsed[cat]);
          if (!Number.isNaN(val) && val >= 0) {
            validated[cat] = Number(val.toFixed(2));
          }
        }
        return validated;
      }
    }
  } catch (e) {
    console.warn('[BudgetStorage] Could not load category budgets:', e);
  }
  return { ...DEFAULT_CATEGORY_BUDGETS };
}

/**
 * Saves monthly spending budget limits per category to localStorage.
 */
export function saveCategoryBudgets(budgets: CategoryBudgets): void {
  try {
    const sanitized: CategoryBudgets = { ...DEFAULT_CATEGORY_BUDGETS };
    for (const cat of ALL_RECEIPT_CATEGORIES) {
      const val = Number(budgets[cat]);
      sanitized[cat] = !Number.isNaN(val) && val >= 0 ? Number(val.toFixed(2)) : 0;
    }
    localStorage.setItem(CATEGORY_BUDGETS_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (e) {
    console.error('[BudgetStorage] Failed to save category budgets:', e);
  }
}

export interface OverallBudgetSummary {
  totalBudget: number;
  budgetedSpend: number;
  totalMonthSpend: number;
  percentUsed: number;
  barWidthPercent: number;
  remaining: number;
  overAmount: number;
  status: 'within' | 'near' | 'exceeded' | 'unset';
  activeCategoriesCount: number;
  exceededCount: number;
  nearCount: number;
}

/**
 * Computes per-category and overall monthly budget progress for a given month's category spend totals.
 */
export function computeCategoryBudgetProgress(
  categoryTotals: Record<ReceiptCategory, number>,
  budgets: CategoryBudgets
): {
  categories: CategoryBudgetProgress[];
  overall: OverallBudgetSummary;
} {
  let totalBudget = 0;
  let budgetedSpend = 0;
  let totalMonthSpend = 0;
  let activeCategoriesCount = 0;
  let exceededCount = 0;
  let nearCount = 0;

  const categories: CategoryBudgetProgress[] = ALL_RECEIPT_CATEGORIES.map((category) => {
    const spent = Number((categoryTotals[category] || 0).toFixed(2));
    const limit = Math.max(0, Number((budgets[category] ?? 0).toFixed(2)));
    totalMonthSpend += spent;

    if (limit <= 0) {
      return {
        category,
        spent,
        limit: 0,
        percentUsed: 0,
        barWidthPercent: 0,
        remaining: 0,
        overAmount: 0,
        status: 'unset',
      };
    }

    activeCategoriesCount += 1;
    totalBudget += limit;
    budgetedSpend += spent;

    const rawPercent = (spent / limit) * 100;
    const percentUsed = Number(rawPercent.toFixed(1));
    const barWidthPercent = Math.min(100, Math.max(0, rawPercent));
    const diff = Number((limit - spent).toFixed(2));
    const remaining = diff > 0 ? diff : 0;
    const overAmount = diff < 0 ? Math.abs(diff) : 0;

    let status: CategoryBudgetProgress['status'] = 'within';
    if (rawPercent >= 100) {
      status = 'exceeded';
      exceededCount += 1;
    } else if (rawPercent >= 80) {
      status = 'near';
      nearCount += 1;
    }

    return {
      category,
      spent,
      limit,
      percentUsed,
      barWidthPercent,
      remaining,
      overAmount,
      status,
    };
  });

  totalBudget = Number(totalBudget.toFixed(2));
  budgetedSpend = Number(budgetedSpend.toFixed(2));
  totalMonthSpend = Number(totalMonthSpend.toFixed(2));

  let overallStatus: OverallBudgetSummary['status'] = 'unset';
  let overallPercent = 0;
  let overallBarWidth = 0;
  let overallRemaining = 0;
  let overallOver = 0;

  if (totalBudget > 0) {
    const rawOverallPercent = (budgetedSpend / totalBudget) * 100;
    overallPercent = Number(rawOverallPercent.toFixed(1));
    overallBarWidth = Math.min(100, Math.max(0, rawOverallPercent));
    const diff = Number((totalBudget - budgetedSpend).toFixed(2));
    overallRemaining = diff > 0 ? diff : 0;
    overallOver = diff < 0 ? Math.abs(diff) : 0;

    if (rawOverallPercent >= 100) {
      overallStatus = 'exceeded';
    } else if (rawOverallPercent >= 80) {
      overallStatus = 'near';
    } else {
      overallStatus = 'within';
    }
  }

  return {
    categories,
    overall: {
      totalBudget,
      budgetedSpend,
      totalMonthSpend,
      percentUsed: overallPercent,
      barWidthPercent: overallBarWidth,
      remaining: overallRemaining,
      overAmount: overallOver,
      status: overallStatus,
      activeCategoriesCount,
      exceededCount,
      nearCount,
    },
  };
}
