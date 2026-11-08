import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  HardDrive,
  Clock,
  Shield,
  Trash2,
  Sun,
  Moon,
  Check,
  X,
  ExternalLink,
  GitBranch,
  CheckCircle2,
  ArrowUpCircle,
} from 'lucide-react';
import type { SavedReceipt } from '../types';
import {
  SUPPORTED_CURRENCIES,
  setPreferredCurrency,
  formatMoney,
} from '../utils/currencyFormat';
import {
  FREE_MONTHLY_SMART_SCANS,
  MID_MONTHLY_SMART_SCANS,
  MID_MAX_BATCH_PHOTOS,
  restorePlayPurchases,
  downgradeToFreeTier,
  type SubscriptionState,
  type UpgradeTriggerReason,
} from '../utils/subscriptionManager';
import { getDisplayVersionInfo } from '../constants/appVersion';

interface SettingsViewProps {
  receipts: SavedReceipt[];
  subscriptionState: SubscriptionState;
  currencyCode: string;
  onCurrencyChange: (code: string) => void;
  darkMode: boolean;
  onToggleDarkMode: (dark: boolean) => void;
  pendingOfflineCount: number;
  onOpenUpgrade: (reason: UpgradeTriggerReason) => void;
  onOpenBudgetModal: () => void;
  onOpenBackupModal: () => void;
  onOpenOfflineQueue: () => void;
  onResetAllReceipts: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  receipts,
  subscriptionState,
  currencyCode,
  onCurrencyChange,
  darkMode,
  onToggleDarkMode,
  pendingOfflineCount,
  onOpenUpgrade,
  onOpenBudgetModal,
  onOpenBackupModal,
  onOpenOfflineQueue,
  onResetAllReceipts,
}) => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDowngrade, setConfirmDowngrade] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [versionInfo, setVersionInfo] = useState(() => getDisplayVersionInfo());

  React.useEffect(() => {
    const syncNativeVersion = () => setVersionInfo(getDisplayVersionInfo());
    window.addEventListener('parserpro-native-version', syncNativeVersion);
    return () => window.removeEventListener('parserpro-native-version', syncNativeVersion);
  }, []);

  const tier = subscriptionState.tier;
  const totalSavedSpend = receipts.reduce(
    (sum, r) => sum + (Number(r.total_amount) || 0),
    0
  );

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    setRestoreMessage(null);
    try {
      const result = await restorePlayPurchases();
      setRestoreMessage(result.message);
    } catch {
      setRestoreMessage('Could not check Google Play purchases right now. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCurrencySelect = (code: string) => {
    setPreferredCurrency(code);
    onCurrencyChange(code);
  };

  const activePlanLabel =
    tier === 'full'
      ? 'Full Package · $3.99/mo'
      : tier === 'mid'
      ? 'Mid Tier · $1.99/mo'
      : 'Free Tier · $0/mo';

  const [remoteVersionData, setRemoteVersionData] = useState<{ tagName: string; htmlUrl: string } | null>(null);
  const [isCheckingVersion, setIsCheckingVersion] = useState(false);
  const [versionCheckStatus, setVersionCheckStatus] = useState<'idle' | 'up_to_date' | 'update_available' | 'offline'>('idle');

  const checkRemoteVersion = async () => {
    setIsCheckingVersion(true);
    try {
      const resp = await fetch('https://api.github.com/repos/hermsasshole-max/Parserpro/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!resp.ok) throw new Error('Failed to reach GitHub API');
      const data = await resp.json();
      const tagName = data.tag_name || '';
      const htmlUrl = data.html_url || 'https://github.com/hermsasshole-max/Parserpro/releases';
      setRemoteVersionData({ tagName, htmlUrl });
      
      const remoteClean = tagName.replace(/^v/, '').trim();
      const localClean = versionInfo.versionName.replace(/^v/, '').trim();
      if (remoteClean && remoteClean !== localClean) {
        setVersionCheckStatus('update_available');
      } else {
        setVersionCheckStatus('up_to_date');
      }
    } catch {
      setVersionCheckStatus('offline');
    } finally {
      setIsCheckingVersion(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Account &amp; Preferences
          </h1>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {versionInfo.displayLabel}
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          Manage your Google Play plan, currency, household budgets, and private device backups.
        </p>
      </div>

      {/* Version Status & Updates Card */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Version Status &amp; Updates
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              Installed: <strong className="font-semibold text-slate-900 dark:text-white">v{versionInfo.versionName}</strong> (Build {versionInfo.buildNumber}) · AGP {versionInfo.agpVersion}
            </p>
          </div>

          <button
            type="button"
            disabled={isCheckingVersion}
            onClick={checkRemoteVersion}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingVersion ? 'animate-spin' : ''}`} />
            <span>{isCheckingVersion ? 'Checking Server...' : 'Check for Updates'}</span>
          </button>
        </div>

        {versionCheckStatus !== 'idle' && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {versionCheckStatus === 'up_to_date' && (
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>You are running the latest app version ({versionInfo.versionName}).</span>
              </div>
            )}
            {versionCheckStatus === 'update_available' && (
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                <ArrowUpCircle className="w-4 h-4 shrink-0" />
                <span>New version {remoteVersionData?.tagName} available on GitHub &amp; Play Console!</span>
              </div>
            )}
            {versionCheckStatus === 'offline' && (
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Clock className="w-4 h-4 shrink-0" />
                <span>Offline mode — running local build v{versionInfo.versionName} (Build {versionInfo.buildNumber}).</span>
              </div>
            )}

            {remoteVersionData?.htmlUrl && (
              <a
                href={remoteVersionData.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
              >
                <span>View Release Notes</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}
      </section>

      {/* Membership & Google Play Billing Card */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Current Plan
            </p>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
              {activePlanLabel}
            </h2>
            {tier === 'full' ? (
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Unlimited automatic scans, unlimited stack batching, 6-month spending charts, Excel
                spreadsheet exports, all 5 category budgets, and full device backups are active.
              </p>
            ) : tier === 'mid' ? (
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 tabular-nums">
                <strong className="font-semibold text-slate-900 dark:text-white">
                  {subscriptionState.smartScansRemaining} of {MID_MONTHLY_SMART_SCANS}
                </strong>{' '}
                scans remaining for {subscriptionState.currentMonthKey} · Up to{' '}
                {MID_MAX_BATCH_PHOTOS}-photo batching, all 5 category budgets, full A–Z monthly
                variances & Monthly PDF Statements active.
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 tabular-nums">
                <strong className="font-semibold text-slate-900 dark:text-white">
                  {subscriptionState.smartScansRemaining} of {FREE_MONTHLY_SMART_SCANS}
                </strong>{' '}
                free scans remaining for {subscriptionState.currentMonthKey} · Manual entries &
                single-slip PDFs are always unlimited.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenUpgrade('general')}
            className={`min-h-[48px] px-5 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 ${
              tier === 'full'
                ? 'border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {tier !== 'full' && <Sparkles className="w-4 h-4" />}
            <span>
              {tier === 'full'
                ? 'Compare Plans'
                : tier === 'mid'
                ? 'Upgrade to Full ($3.99/mo)'
                : 'View Plans ($1.99 / $3.99)'}
            </span>
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={isRestoring}
            onClick={handleRestorePurchases}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
            <span>Restore Google Play Purchase</span>
          </button>

          {tier !== 'free' && (
            <div>
              {confirmDowngrade ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Switch back to Free tier?</span>
                  <button
                    type="button"
                    onClick={() => {
                      downgradeToFreeTier();
                      setConfirmDowngrade(false);
                    }}
                    className="min-h-[38px] px-3 py-1 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDowngrade(false)}
                    className="min-h-[38px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDowngrade(true)}
                  className="min-h-[40px] px-2 py-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Switch to Free Tier
                </button>
              )}
            </div>
          )}
        </div>

        {restoreMessage && (
          <div className="rounded-xl bg-slate-100 dark:bg-slate-800/80 px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between gap-2">
            <span>{restoreMessage}</span>
            <button
              type="button"
              onClick={() => setRestoreMessage(null)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Dismiss message"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>

      {/* Household Preferences */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        {/* Currency Preference */}
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
              Display Currency
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Used for your totals, budgets, and monthly statements.
            </p>
          </div>
          <select
            aria-label="Display currency"
            value={currencyCode}
            onChange={(e) => handleCurrencySelect(e.target.value)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            {SUPPORTED_CURRENCIES.map((cur) => (
              <option key={cur.code} value={cur.code}>
                {cur.name}
              </option>
            ))}
          </select>
        </div>

        {/* Appearance */}
        <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
              Appearance
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Choose comfortable daylight or dark contrast.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => onToggleDarkMode(false)}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                !darkMode
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleDarkMode(true)}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                darkMode
                  ? 'bg-slate-900 text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark</span>
            </button>
          </div>
        </div>

        {/* Category Budgets */}
        <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
              Monthly Category Budgets
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Set spending alerts for groceries, utilities, fuel, and home upkeep.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenBudgetModal}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Edit Budgets</span>
          </button>
        </div>
      </section>

      {/* Data, Backups & Offline Storage */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
              Backups & Excel Spreadsheets
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {receipts.length} saved {receipts.length === 1 ? 'receipt' : 'receipts'} on this
              device ({formatMoney(totalSavedSpend, currencyCode)}) · Restoring backups is always
              free.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenBackupModal}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <HardDrive className="w-4 h-4" />
            <span>Manage</span>
          </button>
        </div>

        <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
              Pending Offline Scans
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {pendingOfflineCount === 0
                ? 'All scanned receipts are up to date.'
                : `${pendingOfflineCount} offline receipt ${
                    pendingOfflineCount === 1 ? 'photo' : 'photos'
                  } waiting.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenOfflineQueue}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Clock className="w-4 h-4" />
            <span>View Queue</span>
          </button>
        </div>
      </section>

      {/* Privacy & Safe Reset */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
              Privacy & Data Protection
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Your ledger is stored privately on your phone. We never sell or share financial data.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPrivacyModal(true)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Shield className="w-4 h-4" />
            <span>Privacy Policy</span>
          </button>
        </div>

        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
              Clear All Saved Receipts
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Start fresh with an empty ledger on this device.
            </p>
          </div>

          {confirmReset ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onResetAllReceipts();
                  setConfirmReset(false);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold whitespace-nowrap"
              >
                Confirm Clear All
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={receipts.length === 0}
              onClick={() => setConfirmReset(true)}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/70 text-xs sm:text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-40 flex items-center gap-2 whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Ledger</span>
            </button>
          )}
        </div>
      </section>

      <div className="pt-1 pb-2 text-center text-xs text-slate-400 dark:text-slate-500 tabular-nums">
        ParserPro {versionInfo.displayLabel}
      </div>

      {/* In-App Privacy Policy Summary Modal */}
      {showPrivacyModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="privacy-modal-title"
        >
          <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 pb-safe-modal space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4">
              <h2
                id="privacy-modal-title"
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                Privacy Summary
              </h2>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                aria-label="Close privacy summary"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Local-First Ledger:</strong> All saved receipts, budgets, and reports are
                  stored privately on your own device.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Encrypted Smart Scanning:</strong> When scanning online, receipt photos
                  are transmitted securely over HTTPS solely to extract text and line items, and are
                  never sold or shared with advertisers.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Full User Control:</strong> You can delete individual receipts or wipe
                  your entire device ledger at any time with a single tap.
                </span>
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                <span>Read full Privacy Policy</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white text-xs sm:text-sm font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
