import React, { useState } from 'react';
import { X, Check, ShieldCheck, RotateCcw, Loader2 } from 'lucide-react';
import {
  getLocalizedPlans,
  purchaseSubscriptionPlan,
  restorePlayPurchases,
  FREE_MONTHLY_SMART_SCANS,
  FREE_MAX_ACTIVE_BUDGETS,
  type PlayBillingSku,
  type SubscriptionState,
  type UpgradeTriggerReason,
} from '../utils/subscriptionManager';

interface UpgradeProModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: UpgradeTriggerReason;
  currencyCode?: string;
  subscriptionState: SubscriptionState;
  onSubscriptionUpdated: (newState: SubscriptionState) => void;
}

const REASON_HEADLINES: Record<UpgradeTriggerReason, { title: string; subtitle: string }> = {
  general: {
    title: 'Do more with ParserPro Plus',
    subtitle: 'Unlimited receipt scans, full item price history, all category budgets, and instant Excel exports.',
  },
  scan_limit_reached: {
    title: `You've used all ${FREE_MONTHLY_SMART_SCANS} free smart scans this month`,
    subtitle: 'You can still add receipts manually anytime for free, or upgrade to Plus for unlimited automatic scanning.',
  },
  batch_multi_photo: {
    title: 'Scan multiple photos at once with Plus',
    subtitle: 'Free accounts scan one photo at a time. Upgrade to Plus to batch-scan entire stacks of receipts in seconds.',
  },
  unlimited_budgets: {
    title: 'Unlock budgets across every category',
    subtitle: `Your free plan includes up to ${FREE_MAX_ACTIVE_BUDGETS} active category budgets. Upgrade to set limits across all household categories.`,
  },
  csv_export: {
    title: 'Export spreadsheets to Excel & CSV',
    subtitle: 'Download your complete itemized purchase history as a clean spreadsheet ready for Excel, Google Sheets, or tax filing.',
  },
  full_backup: {
    title: 'One-tap full backups & rollback snapshots',
    subtitle: 'Restoring an existing backup is always free. Upgrade to Plus to save unlimited full device backup files and instant snapshots.',
  },
  price_history: {
    title: 'See every price change & 6-month spending trends',
    subtitle: 'Track store price increases across your entire A–Z grocery list and visualize 6 months of household spending.',
  },
};

export const UpgradeProModal: React.FC<UpgradeProModalProps> = ({
  isOpen,
  onClose,
  reason = 'general',
  currencyCode,
  subscriptionState,
  onSubscriptionUpdated,
}) => {
  const plans = getLocalizedPlans(currencyCode);
  const [selectedSku, setSelectedSku] = useState<PlayBillingSku>('parserpro_plus_annual');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showTestCheckoutConfirm, setShowTestCheckoutConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const copy = REASON_HEADLINES[reason] || REASON_HEADLINES.general;
  const activePlanObj = plans.find((p) => p.sku === selectedSku) || plans[0];

  const handleCheckout = async (confirmTestMode: boolean = false) => {
    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await purchaseSubscriptionPlan(selectedSku, confirmTestMode);
      if (res.requiresTestConfirmation) {
        setShowTestCheckoutConfirm(true);
        setIsProcessing(false);
        return;
      }
      if (res.success && res.state) {
        onSubscriptionUpdated(res.state);
        setShowTestCheckoutConfirm(false);
        setFeedback({ type: 'success', text: res.message });
        setTimeout(() => {
          onClose();
        }, 1100);
      } else {
        setFeedback({ type: 'info', text: res.message });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.message || 'Could not complete Google Play checkout.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setFeedback(null);
    try {
      const res = await restorePlayPurchases();
      onSubscriptionUpdated(res.state);
      setFeedback({
        type: res.restored ? 'success' : 'info',
        text: res.message,
      });
      if (res.restored) {
        setTimeout(() => onClose(), 1200);
      }
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto no-print"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile grab handle */}
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 shrink-0" />

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-emerald-700">
              ParserPro Plus · Google Play Billing
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight [text-wrap:balance]">
              {copy.title}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
              {copy.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close upgrade window"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="px-6 py-5 overflow-y-auto space-y-6 flex-1">
          {feedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : feedback.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Google Play Test Checkout Confirmation Step (shown when testing outside Play Store client) */}
          {showTestCheckoutConfirm ? (
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-4">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-500">
                  Google Play Billing · License Tester Mode
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Confirm test purchase: {activePlanObj.name} ({activePlanObj.formattedPrice})
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  You are currently running in preview or internal testing mode outside the live Google Play Store billing client. Confirming below simulates an approved Google Play test card so you can test every Plus feature immediately.
                </p>
              </div>

              <div className="py-3 border-y border-slate-200 flex items-center justify-between text-xs tabular-nums">
                <span className="text-slate-600">Payment method</span>
                <span className="font-semibold text-slate-900">Test card, always approves</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowTestCheckoutConfirm(false)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Back to Plans
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleCheckout(true)}
                  className="flex-1 min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>Approve Test Purchase &amp; Unlock Plus</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Plan Selector Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {plans.map((plan) => {
                  const isSelected = selectedSku === plan.sku;
                  return (
                    <button
                      key={plan.sku}
                      type="button"
                      onClick={() => setSelectedSku(plan.sku)}
                      className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-900">{plan.name}</span>
                          {plan.savingsLabel && (
                            <span className="text-xs font-semibold text-emerald-700 tabular-nums">
                              {plan.savingsLabel}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{plan.audienceLabel}</div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                          {plan.formattedPrice}
                        </div>
                        <div className="text-xs text-slate-500">
                          {plan.cadenceLabel}
                          {plan.trialLabel ? ` · ${plan.trialLabel}` : ''}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Concrete Free vs Plus Comparison Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Included Features</th>
                      <th className="py-3 px-3 text-right">Free Starter</th>
                      <th className="py-3 px-4 text-right text-emerald-800">ParserPro Plus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 tabular-nums">
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-slate-900">Automatic receipt photo scans</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">{FREE_MONTHLY_SMART_SCANS} / month</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">Unlimited</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-slate-900">Batch multi-photo scanning</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">1 photo at a time</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">Unlimited batch</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-slate-900">Manual entries, editing &amp; search</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">Unlimited</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">Unlimited</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-slate-900">Monthly category budgets</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">Up to {FREE_MAX_ACTIVE_BUDGETS} categories</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">All categories</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-slate-900">Price history &amp; 6-month trend chart</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">Top 8 items</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">Full A–Z &amp; 6-mo chart</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-slate-900">Excel / CSV &amp; full device backups</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">PDF &amp; restore</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">CSV, PDF &amp; backups</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Sticky Bottom Action Bar */}
        {!showTestCheckoutConfirm && (
          <div className="px-6 py-4 pb-safe-modal border-t border-slate-200 bg-slate-50 flex flex-col gap-3 shrink-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500 leading-snug">
                <div className="font-semibold text-slate-800">{activePlanObj.subPriceNote}</div>
                <div>Secured by Google Play · Manage or cancel anytime in Play Store Subscriptions</div>
              </div>

              <button
                type="button"
                disabled={isProcessing || subscriptionState.tier === 'plus'}
                onClick={() => handleCheckout(false)}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {subscriptionState.tier === 'plus'
                    ? 'Plus Active'
                    : activePlanObj.trialLabel
                    ? `Start 7-Day Free Trial · ${activePlanObj.formattedPrice}`
                    : `Continue · ${activePlanObj.formattedPrice}`}
                </span>
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-200/70">
              <button
                type="button"
                disabled={isRestoring}
                onClick={handleRestore}
                className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer py-1"
              >
                {isRestoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>Restore Google Play Purchase</span>
              </button>
              <span>100% private on-device ledger</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
