import React, { useEffect, useState } from 'react';
import {
  X,
  Check,
  Minus,
  RefreshCw,
  ShieldCheck,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  getThreeTierPlans,
  getRecommendedSkuForReason,
  fetchLivePlayStorePrices,
  purchaseSubscriptionPlan,
  restorePlayPurchases,
  downgradeToFreeTier,
  FREE_MONTHLY_SMART_SCANS,
  MID_MONTHLY_SMART_SCANS,
  MID_MAX_BATCH_PHOTOS,
  FREE_MAX_ACTIVE_BUDGETS,
  ALL_CATEGORY_BUDGETS_COUNT,
  FREE_MONTHLY_VARIANCE_PREVIEW_LIMIT,
  FREE_PRICE_COMPARISON_PREVIEW_LIMIT,
  MID_PRICE_COMPARISON_PREVIEW_LIMIT,
  type PlayBillingSku,
  type SubscriptionState,
  type SubscriptionTier,
  type UpgradeTriggerReason,
} from '../utils/subscriptionManager';

interface UpgradeProModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: UpgradeTriggerReason;
  currencyCode: string;
  subscriptionState: SubscriptionState;
  onSubscriptionUpdated: (nextState: SubscriptionState) => void;
}

const REASON_HEADLINES: Record<
  UpgradeTriggerReason,
  { title: string; subtitle: string }
> = {
  general: {
    title: 'Choose the right ParserPro plan for your household',
    subtitle:
      'Start free, step up to Mid Tier ($1.99/mo) for everyday grocery tracking, or unlock the Full Package ($3.99/mo) for unlimited power.',
  },
  scan_limit_reached: {
    title: 'Need more automatic receipt scans this month?',
    subtitle:
      'Upgrade to Mid Tier ($1.99/mo) for 75 monthly scans, or unlock unlimited scanning with the Full Package ($3.99/mo). Manual entry stays free.',
  },
  batch_multi_photo: {
    title: 'Scan multiple receipt photos in one batch',
    subtitle:
      'Mid Tier ($1.99/mo) lets you batch up to 3 photos at once, while Full Package ($3.99/mo) unlocks unlimited receipt stacks.',
  },
  unlimited_batch_stack: {
    title: 'Unlock unlimited receipt stack batching',
    subtitle:
      'Step up to the Full Package ($3.99/mo) to queue and extract entire stacks of receipts in a single pass.',
  },
  unlimited_budgets: {
    title: 'Track budgets across all 5 household categories',
    subtitle:
      'Unlock all 5 category spending limits starting with Mid Tier ($1.99/mo) or Full Package ($3.99/mo).',
  },
  monthly_variance_full: {
    title: 'See every item’s monthly purchase frequency & price spread',
    subtitle:
      'Unlock the full A–Z monthly item variance breakdown and chronological store history starting at $1.99/mo.',
  },
  monthly_statement_pdf: {
    title: 'Export consolidated Monthly PDF Statements',
    subtitle:
      'Single-receipt PDFs are always free. Unlock full-month PDF statements & printouts starting with Mid Tier ($1.99/mo).',
  },
  price_history: {
    title: 'Unlock full A–Z month-to-month item comparisons',
    subtitle:
      'Compare every matched item across billing periods and export comparison PDFs with the Full Package ($3.99/mo).',
  },
  six_month_chart: {
    title: 'Unlock the interactive 6-Month Spending Timeline',
    subtitle:
      'Spot multi-month grocery, utility, and fuel trends with the Full Package ($3.99/mo).',
  },
  csv_export: {
    title: 'Export your ledger to Excel & CSV spreadsheets',
    subtitle:
      'Download monthly summaries, month-to-month comparisons, and all-time itemized spreadsheets with the Full Package ($3.99/mo).',
  },
  full_backup: {
    title: 'Save full device backups & instant recovery points',
    subtitle:
      'Restoring a backup is always free. Unlock one-tap .json backup exports and recovery snapshots with the Full Package ($3.99/mo).',
  },
};

interface FeatureMatrixRow {
  feature: string;
  free: string | boolean;
  mid: string | boolean;
  full: string | boolean;
}

const FEATURE_MATRIX: FeatureMatrixRow[] = [
  {
    feature: 'Automatic photo scans / month',
    free: `${FREE_MONTHLY_SMART_SCANS} / mo`,
    mid: `${MID_MONTHLY_SMART_SCANS} / mo`,
    full: 'Unlimited',
  },
  {
    feature: 'Multi-photo batch scanning',
    free: '1 photo',
    mid: `Up to ${MID_MAX_BATCH_PHOTOS}`,
    full: 'Unlimited stack',
  },
  {
    feature: 'Manual receipt entry & duplicate blocker',
    free: 'Unlimited',
    mid: 'Unlimited',
    full: 'Unlimited',
  },
  {
    feature: 'Active monthly category budgets',
    free: `Up to ${FREE_MAX_ACTIVE_BUDGETS}`,
    mid: `All ${ALL_CATEGORY_BUDGETS_COUNT}`,
    full: `All ${ALL_CATEGORY_BUDGETS_COUNT}`,
  },
  {
    feature: 'Monthly item frequency & price variance',
    free: `Top ${FREE_MONTHLY_VARIANCE_PREVIEW_LIMIT} items`,
    mid: 'Full A–Z',
    full: 'Full A–Z',
  },
  {
    feature: 'PDF exports & printing',
    free: 'Single slip',
    mid: '+ Monthly PDF',
    full: '+ Compare PDF',
  },
  {
    feature: 'Month-to-month item comparison',
    free: `Top ${FREE_PRICE_COMPARISON_PREVIEW_LIMIT} items`,
    mid: `Top ${MID_PRICE_COMPARISON_PREVIEW_LIMIT} items`,
    full: 'Unlimited A–Z',
  },
  {
    feature: '6-Month interactive spending chart',
    free: false,
    mid: false,
    full: true,
  },
  {
    feature: 'Excel / CSV spreadsheet exports',
    free: false,
    mid: false,
    full: true,
  },
  {
    feature: 'Device .json backups & recovery points',
    free: 'Restore free',
    mid: 'Restore free',
    full: 'Save & Restore',
  },
];

export const UpgradeProModal: React.FC<UpgradeProModalProps> = ({
  isOpen,
  onClose,
  reason,
  currencyCode,
  subscriptionState,
  onSubscriptionUpdated,
}) => {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('full');
  const [livePrices, setLivePrices] = useState<Partial<Record<PlayBillingSku, string>>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [requiresTestConfirm, setRequiresTestConfirm] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const recommendedSku = getRecommendedSkuForReason(reason, subscriptionState.tier);
    setSelectedTier(recommendedSku === 'parserpro_mid_monthly' ? 'mid' : 'full');
    setRequiresTestConfirm(false);
    setFeedbackMessage(null);

    let cancelled = false;
    fetchLivePlayStorePrices()
      .then((prices) => {
        if (!cancelled && prices) {
          setLivePrices(prices);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOpen, reason, subscriptionState.tier]);

  if (!isOpen) return null;

  const plans = getThreeTierPlans(currencyCode, livePrices);
  const copy = REASON_HEADLINES[reason] || REASON_HEADLINES.general;
  const currentTier = subscriptionState.tier;
  const selectedPlan = plans.find((p) => p.tier === selectedTier) || plans[2];
  const isCurrentSelection = selectedTier === currentTier;

  const handlePrimaryAction = async (confirmSandbox = false) => {
    if (isCurrentSelection) {
      onClose();
      return;
    }

    if (selectedTier === 'free') {
      const next = downgradeToFreeTier();
      onSubscriptionUpdated(next);
      setFeedbackMessage({
        type: 'info',
        text: 'Switched device preview to Free Tier ($0/mo). Manage live renewals anytime in Google Play → Subscriptions.',
      });
      setTimeout(() => onClose(), 850);
      return;
    }

    const targetSku: PlayBillingSku =
      selectedTier === 'mid' ? 'parserpro_mid_monthly' : 'parserpro_full_monthly';

    setIsProcessing(true);
    setFeedbackMessage(null);
    try {
      const res = await purchaseSubscriptionPlan(targetSku, confirmSandbox);
      if (res.success && res.state) {
        onSubscriptionUpdated(res.state);
        setRequiresTestConfirm(false);
        setFeedbackMessage({ type: 'success', text: res.message });
        setTimeout(() => {
          onClose();
        }, 850);
      } else if (res.requiresTestConfirmation) {
        setRequiresTestConfirm(true);
        setFeedbackMessage({ type: 'info', text: res.message });
      } else {
        setFeedbackMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Unable to connect to Google Play Billing right now.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setFeedbackMessage(null);
    try {
      const res = await restorePlayPurchases();
      onSubscriptionUpdated(res.state);
      setFeedbackMessage({
        type: res.restored ? 'success' : 'info',
        text: res.message,
      });
      if (res.restored && res.state.tier !== 'free') {
        setTimeout(() => onClose(), 950);
      }
    } catch {
      setFeedbackMessage({
        type: 'error',
        text: 'Could not check Google Play purchases right now.',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const renderMatrixCell = (val: string | boolean, highlight: boolean) => {
    if (typeof val === 'boolean') {
      return val ? (
        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
      ) : (
        <Minus className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />
      );
    }
    return (
      <span
        className={`font-mono tabular-nums ${
          highlight
            ? 'font-semibold text-slate-900 dark:text-white'
            : 'text-slate-600 dark:text-slate-300'
        }`}
      >
        {val}
      </span>
    );
  };

  const getPrimaryButtonLabel = (): string => {
    if (isCurrentSelection) {
      return `Current Plan (${selectedPlan.name})`;
    }
    if (selectedTier === 'free') {
      return 'Switch to Free ($0/mo)';
    }
    if (selectedTier === 'mid') {
      return currentTier === 'full'
        ? `Switch to Mid Tier · ${selectedPlan.displayPrice}/mo`
        : `Start Mid Tier · ${selectedPlan.displayPrice}/mo`;
    }
    return currentTier === 'mid'
      ? `Upgrade to Full Package · ${selectedPlan.displayPrice}/mo`
      : `Unlock Full Package · ${selectedPlan.displayPrice}/mo`;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div className="w-full sm:max-w-3xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 shrink-0" />

        {/* Header */}
        <div className="px-5 sm:px-7 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Google Play Plans & Unlocks
            </p>
            <h2
              id="upgrade-modal-title"
              className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white text-balance"
            >
              {copy.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {copy.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close plans dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-7 pb-safe-modal overflow-y-auto space-y-6 flex-1">
          {/* 3-Tier Plan Selector Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {plans.map((plan) => {
              const selected = selectedTier === plan.tier;
              const isCurrent = currentTier === plan.tier;

              return (
                <button
                  key={plan.tier}
                  type="button"
                  onClick={() => {
                    setSelectedTier(plan.tier);
                    setRequiresTestConfirm(false);
                    setFeedbackMessage(null);
                  }}
                  className={`text-left rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                    selected
                      ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/25 ring-1 ring-emerald-600 dark:ring-emerald-500'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-3 w-full">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        {isCurrent
                          ? 'Current Plan'
                          : plan.isRecommended
                          ? 'Full Unlock'
                          : plan.tier === 'mid'
                          ? 'Everyday Value'
                          : 'Starter'}
                      </span>
                      <span
                        className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${
                          selected
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3" />}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {plan.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {plan.tagline}
                      </p>
                    </div>

                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                          {plan.displayPrice}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {plan.tier === 'free' ? 'forever' : '/ month'}
                        </span>
                      </div>
                      {plan.localEstimateNote && (
                        <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                          {plan.localEstimateNote}
                        </p>
                      )}
                      {plan.trialLabel && (
                        <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                          {plan.trialLabel}
                        </p>
                      )}
                    </div>

                    <ul className="space-y-2 pt-1">
                      {plan.highlights.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 leading-snug"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Feedback / Status Message */}
          {feedbackMessage && (
            <div
              className={`rounded-xl px-4 py-3 text-xs sm:text-sm border ${
                feedbackMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : feedbackMessage.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
              }`}
            >
              {feedbackMessage.text}
            </div>
          )}

          {/* License Tester / Preview Confirmation */}
          {requiresTestConfirm && selectedTier !== 'free' && (
            <div className="rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 p-4 space-y-3">
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-semibold text-amber-950 dark:text-amber-200">
                  Google Play License Tester Preview
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                  In production builds downloaded from Google Play with active subscription SKUs (
                  <code className="font-mono">
                    {selectedTier === 'mid' ? 'parserpro_mid_monthly' : 'parserpro_full_monthly'}
                  </code>
                  ), the native Google Play checkout sheet opens automatically. Confirm below to
                  activate {selectedPlan.name} ({selectedPlan.usdMonthlyPrice}/mo) in test mode now:
                </p>
              </div>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handlePrimaryAction(true)}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  Confirm with Google Play Test Card ({selectedPlan.name} ·{' '}
                  {selectedPlan.usdMonthlyPrice}/mo)
                </span>
              </button>
            </div>
          )}

          {/* Primary Checkout Action + Restore */}
          {!requiresTestConfirm && (
            <div className="space-y-2.5">
              <button
                type="button"
                disabled={isProcessing || isCurrentSelection}
                onClick={() => handlePrimaryAction(false)}
                className="w-full min-h-[52px] px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-55 text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:cursor-default"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting to Google Play...</span>
                  </>
                ) : (
                  <>
                    {!isCurrentSelection && selectedTier !== 'free' && (
                      <Sparkles className="w-4 h-4 shrink-0" />
                    )}
                    <span>{getPrimaryButtonLabel()}</span>
                  </>
                )}
              </button>

              {currentTier === 'mid' && selectedTier === 'full' && (
                <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                  Google Play automatically prorates your remaining Mid Tier balance when upgrading
                  to Full Package.
                </p>
              )}
            </div>
          )}

          {/* Complete 3-Tier Feature Unlock Matrix */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                How Features Unlock Across Each Tier
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">
                    <th className="py-2.5 pl-4 pr-3 font-semibold">App Function</th>
                    <th className="py-2.5 px-2.5 text-center font-semibold whitespace-nowrap">
                      Free ($0)
                    </th>
                    <th className="py-2.5 px-2.5 text-center font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      Mid ($1.99)
                    </th>
                    <th className="py-2.5 pl-2.5 pr-4 text-center font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      Full ($3.99)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {FEATURE_MATRIX.map((row) => (
                    <tr key={row.feature} className="bg-white dark:bg-slate-900">
                      <td className="py-2.5 pl-4 pr-3 font-medium text-slate-800 dark:text-slate-200">
                        {row.feature}
                      </td>
                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        {renderMatrixCell(row.free, false)}
                      </td>
                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        {renderMatrixCell(row.mid, selectedTier === 'mid')}
                      </td>
                      <td className="py-2.5 pl-2.5 pr-4 text-center whitespace-nowrap">
                        {renderMatrixCell(row.full, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Restore & Google Play Policy Disclosure */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <button
              type="button"
              disabled={isRestoring}
              onClick={handleRestore}
              className="min-h-[44px] inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
              <span>Restore Google Play Purchase</span>
            </button>

            <p className="text-[11px] leading-relaxed sm:text-right">
              Subscriptions auto-renew monthly via Google Play unless cancelled at least 24 hours
              before renewal in Google Play → Payments & subscriptions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
