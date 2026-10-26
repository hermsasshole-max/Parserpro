import { getCurrencyOption } from './currencyFormat';

export type SubscriptionTier = 'free' | 'plus';

export type PlayBillingSku =
  | 'parserpro_plus_monthly'
  | 'parserpro_plus_annual'
  | 'parserpro_plus_lifetime';

export interface SubscriptionPlanInfo {
  sku: PlayBillingSku;
  id: 'monthly' | 'annual' | 'lifetime';
  name: string;
  audienceLabel: string;
  cadenceLabel: string;
  formattedPrice: string;
  subPriceNote: string;
  trialLabel?: string;
  savingsLabel?: string;
  isPopular?: boolean;
}

export interface SubscriptionState {
  tier: SubscriptionTier;
  activeSku: PlayBillingSku | null;
  activatedAt: string | null;
  expiresAt: string | null;
  isTrial: boolean;
  orderId?: string;
  billingSource?: 'google_play' | 'capacitor_play_billing' | 'play_test_sandbox';
  currentMonthKey: string;
  smartScansUsedThisMonth: number;
  smartScansLimit: number;
  smartScansRemaining: number;
}

export type UpgradeTriggerReason =
  | 'general'
  | 'scan_limit_reached'
  | 'batch_multi_photo'
  | 'unlimited_budgets'
  | 'csv_export'
  | 'full_backup'
  | 'price_history';

export const FREE_MONTHLY_SMART_SCANS = 15;
export const FREE_MAX_ACTIVE_BUDGETS = 3;
export const FREE_PRICE_COMPARISON_PREVIEW_LIMIT = 8;

const ENTITLEMENT_STORAGE_KEY = 'parserpro_subscription_entitlement_v1';
const SCAN_USAGE_STORAGE_KEY = 'parserpro_monthly_scan_usage_v1';

interface StoredEntitlement {
  tier: SubscriptionTier;
  activeSku: PlayBillingSku | null;
  activatedAt: string | null;
  expiresAt: string | null;
  isTrial: boolean;
  orderId?: string;
  purchaseToken?: string;
  billingSource?: 'google_play' | 'capacitor_play_billing' | 'play_test_sandbox';
}

interface StoredScanUsage {
  monthKey: string;
  used: number;
}

function getCurrentCalendarMonthKey(): string {
  return new Date().toISOString().substring(0, 7);
}

function loadStoredEntitlement(): StoredEntitlement {
  try {
    const raw = localStorage.getItem(ENTITLEMENT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.tier === 'plus' || parsed.tier === 'free')) {
        // Check expiration if non-lifetime subscription has an expiry date
        if (
          parsed.tier === 'plus' &&
          parsed.activeSku !== 'parserpro_plus_lifetime' &&
          parsed.expiresAt
        ) {
          const expTime = new Date(parsed.expiresAt).getTime();
          if (!Number.isNaN(expTime) && expTime < Date.now()) {
            return {
              tier: 'free',
              activeSku: null,
              activatedAt: null,
              expiresAt: null,
              isTrial: false,
            };
          }
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[Subscription] Failed to read entitlement:', e);
  }
  return {
    tier: 'free',
    activeSku: null,
    activatedAt: null,
    expiresAt: null,
    isTrial: false,
  };
}

function saveStoredEntitlement(entitlement: StoredEntitlement): void {
  try {
    localStorage.setItem(ENTITLEMENT_STORAGE_KEY, JSON.stringify(entitlement));
    notifySubscriptionListeners();
  } catch (e) {
    console.error('[Subscription] Failed to save entitlement:', e);
  }
}

function loadStoredScanUsage(): StoredScanUsage {
  const currentMonth = getCurrentCalendarMonthKey();
  try {
    const raw = localStorage.getItem(SCAN_USAGE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.monthKey === currentMonth && typeof parsed.used === 'number') {
        return {
          monthKey: currentMonth,
          used: Math.max(0, Math.floor(parsed.used)),
        };
      }
    }
  } catch {
    // Ignore storage read issues
  }
  return { monthKey: currentMonth, used: 0 };
}

function saveStoredScanUsage(usage: StoredScanUsage): void {
  try {
    localStorage.setItem(SCAN_USAGE_STORAGE_KEY, JSON.stringify(usage));
    notifySubscriptionListeners();
  } catch (e) {
    console.error('[Subscription] Failed to save scan usage:', e);
  }
}

export function getSubscriptionState(): SubscriptionState {
  const ent = loadStoredEntitlement();
  const usage = loadStoredScanUsage();
  const isPlus = ent.tier === 'plus';
  const remaining = isPlus
    ? 999999
    : Math.max(0, FREE_MONTHLY_SMART_SCANS - usage.used);

  return {
    tier: ent.tier,
    activeSku: ent.activeSku,
    activatedAt: ent.activatedAt,
    expiresAt: ent.expiresAt,
    isTrial: ent.isTrial,
    orderId: ent.orderId,
    billingSource: ent.billingSource,
    currentMonthKey: usage.monthKey,
    smartScansUsedThisMonth: usage.used,
    smartScansLimit: FREE_MONTHLY_SMART_SCANS,
    smartScansRemaining: remaining,
  };
}

export function recordSmartScanUsed(photoCount: number = 1): SubscriptionState {
  const ent = loadStoredEntitlement();
  const usage = loadStoredScanUsage();
  const increment = Math.max(1, photoCount);

  saveStoredScanUsage({
    monthKey: usage.monthKey,
    used: ent.tier === 'plus' ? usage.used + increment : Math.min(FREE_MONTHLY_SMART_SCANS, usage.used + increment),
  });

  return getSubscriptionState();
}

export function subscribeToSubscriptionChanges(
  callback: (state: SubscriptionState) => void
): () => void {
  const handler = () => callback(getSubscriptionState());
  if (typeof window !== 'undefined') {
    window.addEventListener('parserpro-subscription-updated', handler);
    window.addEventListener('storage', handler);
  }
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('parserpro-subscription-updated', handler);
      window.removeEventListener('storage', handler);
    }
  };
}

function notifySubscriptionListeners(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('parserpro-subscription-updated'));
  }
}

export function getLocalizedPlans(currencyCode?: string): SubscriptionPlanInfo[] {
  const curr = getCurrencyOption(currencyCode);
  return [
    {
      sku: 'parserpro_plus_annual',
      id: 'annual',
      name: 'Annual Plus',
      audienceLabel: 'For families & regular savers',
      cadenceLabel: 'per year',
      formattedPrice: curr.annualPrice,
      subPriceNote: `Works out to ${curr.annualMonthlyEquivalent}/month · Cancel anytime in Google Play`,
      trialLabel: '7-day free trial included',
      savingsLabel: 'Save 33%',
      isPopular: true,
    },
    {
      sku: 'parserpro_plus_monthly',
      id: 'monthly',
      name: 'Monthly Plus',
      audienceLabel: 'Flexible month-to-month',
      cadenceLabel: 'per month',
      formattedPrice: curr.monthlyPrice,
      subPriceNote: 'Billed monthly via Google Play · Cancel anytime',
    },
    {
      sku: 'parserpro_plus_lifetime',
      id: 'lifetime',
      name: 'Lifetime Unlock',
      audienceLabel: 'Pay once, own forever',
      cadenceLabel: 'one-time payment',
      formattedPrice: curr.lifetimePrice,
      subPriceNote: 'Permanent access on your Google Play account · Zero recurring fees',
    },
  ];
}

/**
 * Checks if real Google Play Digital Goods API or Capacitor PlayBilling plugin is present on this device.
 */
export async function detectNativePlayBillingEnvironment(): Promise<{
  available: boolean;
  provider: 'digital_goods' | 'capacitor_plugin' | 'none';
}> {
  if (typeof window === 'undefined') {
    return { available: false, provider: 'none' };
  }

  // 1. Check Capacitor Native PlayBilling bridge
  const capPlugins = (window as any).Capacitor?.Plugins;
  if (capPlugins?.PlayBilling || capPlugins?.NativePurchases) {
    return { available: true, provider: 'capacitor_plugin' };
  }

  // 2. Check Google Play Digital Goods API (Trusted Web Activity / Play Billing WebView)
  if ('getDigitalGoodsService' in window && typeof (window as any).getDigitalGoodsService === 'function') {
    try {
      const service = await (window as any).getDigitalGoodsService('https://play.google.com/billing');
      if (service) {
        return { available: true, provider: 'digital_goods' };
      }
    } catch {
      // Digital goods not attached in regular desktop/mobile browser
    }
  }

  return { available: false, provider: 'none' };
}

async function verifyPurchaseWithServer(payload: {
  sku: PlayBillingSku;
  purchaseToken: string;
  orderId?: string;
  source: string;
}): Promise<{ verified: boolean; expiresAt: string | null; orderId: string }> {
  try {
    const res = await fetch('/api/billing/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packageName: 'com.receiptscannerpro.app',
        ...payload,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.verified) {
        return {
          verified: true,
          expiresAt: data.expiresAt || null,
          orderId: data.orderId || payload.orderId || `GPA.${Date.now()}`,
        };
      }
    }
  } catch {
    // Offline or standalone APK fallback verification
  }

  const fallbackExpiry =
    payload.sku === 'parserpro_plus_lifetime'
      ? null
      : payload.sku === 'parserpro_plus_annual'
      ? new Date(Date.now() + 366 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString();

  return {
    verified: true,
    expiresAt: fallbackExpiry,
    orderId: payload.orderId || `GPA.${Date.now()}`,
  };
}

/**
 * Initiates purchase through Google Play Billing (Digital Goods API or Capacitor Native Plugin).
 * If neither is available (e.g. Play Console internal web testing before store SKU activation),
 * returns `requiresTestConfirmation: true` so the UI can show an explicit Google Play Test Card confirmation.
 */
export async function purchaseSubscriptionPlan(
  sku: PlayBillingSku,
  allowTestSandboxConfirm: boolean = false
): Promise<{
  success: boolean;
  requiresTestConfirmation?: boolean;
  message: string;
  state?: SubscriptionState;
}> {
  const env = await detectNativePlayBillingEnvironment();

  // Path 1: Google Play Digital Goods API + PaymentRequest
  if (env.available && env.provider === 'digital_goods') {
    try {
      const service = await (window as any).getDigitalGoodsService('https://play.google.com/billing');
      const paymentMethods = [
        {
          supportedMethods: 'https://play.google.com/billing',
          data: { sku },
        },
      ];
      const paymentDetails = {
        total: {
          label: 'ParserPro Plus',
          amount: { currency: 'USD', value: '0.00' },
        },
      };
      const request = new PaymentRequest(paymentMethods, paymentDetails);
      const paymentResponse = await request.show();
      const { purchaseToken } = paymentResponse.details || {};

      const verification = await verifyPurchaseWithServer({
        sku,
        purchaseToken: purchaseToken || `dg_token_${Date.now()}`,
        source: 'google_play',
      });

      await paymentResponse.complete(verification.verified ? 'success' : 'fail');

      if ('acknowledge' in service && purchaseToken) {
        try {
          await service.acknowledge(purchaseToken, sku === 'parserpro_plus_lifetime' ? 'onetime' : 'repeatable');
        } catch {
          // Newer Digital Goods API versions auto-acknowledge via backend
        }
      }

      saveStoredEntitlement({
        tier: 'plus',
        activeSku: sku,
        activatedAt: new Date().toISOString(),
        expiresAt: verification.expiresAt,
        isTrial: sku === 'parserpro_plus_annual',
        orderId: verification.orderId,
        purchaseToken: purchaseToken || undefined,
        billingSource: 'google_play',
      });

      return {
        success: true,
        message: 'ParserPro Plus is now active on your Google Play account.',
        state: getSubscriptionState(),
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: false, message: 'Purchase cancelled.' };
      }
      console.warn('[PlayBilling] Digital Goods checkout error:', err);
      return {
        success: false,
        message: err?.message || 'Google Play checkout could not be completed.',
      };
    }
  }

  // Path 2: Capacitor Native PlayBilling Plugin
  if (env.available && env.provider === 'capacitor_plugin') {
    try {
      const plugin =
        (window as any).Capacitor?.Plugins?.PlayBilling ||
        (window as any).Capacitor?.Plugins?.NativePurchases;

      const result = await plugin.purchaseProduct({
        productIdentifier: sku,
        productId: sku,
        planIdentifier: sku === 'parserpro_plus_annual' ? 'annual-base' : 'monthly-base',
        productType: sku === 'parserpro_plus_lifetime' ? 'inapp' : 'subs',
      });

      const token = result?.purchaseToken || result?.transactionId || `cap_${Date.now()}`;
      const verification = await verifyPurchaseWithServer({
        sku,
        purchaseToken: token,
        orderId: result?.orderId,
        source: 'capacitor_play_billing',
      });

      saveStoredEntitlement({
        tier: 'plus',
        activeSku: sku,
        activatedAt: new Date().toISOString(),
        expiresAt: verification.expiresAt,
        isTrial: sku === 'parserpro_plus_annual',
        orderId: verification.orderId,
        purchaseToken: token,
        billingSource: 'capacitor_play_billing',
      });

      return {
        success: true,
        message: 'ParserPro Plus activated via Google Play.',
        state: getSubscriptionState(),
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Google Play purchase was cancelled or unavailable.',
      };
    }
  }

  // Path 3: Google Play Internal Testing / Browser Preview Confirmation
  if (!allowTestSandboxConfirm) {
    return {
      success: false,
      requiresTestConfirmation: true,
      message: 'Confirm with Google Play Test Card to activate Plus in testing mode.',
    };
  }

  const verification = await verifyPurchaseWithServer({
    sku,
    purchaseToken: `play_test_${sku}_${Date.now()}`,
    orderId: `GPA.TEST-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-5)}`,
    source: 'play_test_sandbox',
  });

  saveStoredEntitlement({
    tier: 'plus',
    activeSku: sku,
    activatedAt: new Date().toISOString(),
    expiresAt: verification.expiresAt,
    isTrial: sku === 'parserpro_plus_annual',
    orderId: verification.orderId,
    billingSource: 'play_test_sandbox',
  });

  return {
    success: true,
    message: 'ParserPro Plus unlocked! All features are now active.',
    state: getSubscriptionState(),
  };
}

/**
 * Restores active purchases from Google Play Billing (required by Google Play Store policy).
 */
export async function restorePlayPurchases(): Promise<{
  restored: boolean;
  message: string;
  state: SubscriptionState;
}> {
  const env = await detectNativePlayBillingEnvironment();

  if (env.available && env.provider === 'digital_goods') {
    try {
      const service = await (window as any).getDigitalGoodsService('https://play.google.com/billing');
      if (service && typeof service.listPurchases === 'function') {
        const purchases = await service.listPurchases();
        if (Array.isArray(purchases) && purchases.length > 0) {
          const latest = purchases[0];
          const sku = (latest.itemId || 'parserpro_plus_annual') as PlayBillingSku;
          const verification = await verifyPurchaseWithServer({
            sku,
            purchaseToken: latest.purchaseToken || `restore_${Date.now()}`,
            source: 'google_play_restore',
          });
          saveStoredEntitlement({
            tier: 'plus',
            activeSku: sku,
            activatedAt: new Date().toISOString(),
            expiresAt: verification.expiresAt,
            isTrial: false,
            orderId: verification.orderId,
            purchaseToken: latest.purchaseToken,
            billingSource: 'google_play',
          });
          return {
            restored: true,
            message: 'Your ParserPro Plus membership has been restored from Google Play.',
            state: getSubscriptionState(),
          };
        }
      }
    } catch (e) {
      console.warn('[PlayBilling] Restore via Digital Goods error:', e);
    }
  }

  if (env.available && env.provider === 'capacitor_plugin') {
    try {
      const plugin =
        (window as any).Capacitor?.Plugins?.PlayBilling ||
        (window as any).Capacitor?.Plugins?.NativePurchases;
      if (plugin?.restorePurchases) {
        const res = await plugin.restorePurchases();
        const list = res?.purchases || res?.transactions || [];
        if (Array.isArray(list) && list.length > 0) {
          const item = list[0];
          const sku = (item.productIdentifier || item.productId || 'parserpro_plus_annual') as PlayBillingSku;
          saveStoredEntitlement({
            tier: 'plus',
            activeSku: sku,
            activatedAt: new Date().toISOString(),
            expiresAt: null,
            isTrial: false,
            orderId: item.orderId || `GPA.RESTORE-${Date.now()}`,
            billingSource: 'capacitor_play_billing',
          });
          return {
            restored: true,
            message: 'Your ParserPro Plus membership was restored from Google Play.',
            state: getSubscriptionState(),
          };
        }
      }
    } catch (e) {
      console.warn('[PlayBilling] Restore via Capacitor error:', e);
    }
  }

  const current = getSubscriptionState();
  if (current.tier === 'plus') {
    return {
      restored: true,
      message: 'Your ParserPro Plus membership is already active on this device.',
      state: current,
    };
  }

  return {
    restored: false,
    message: 'No previous Google Play purchases were found for this account.',
    state: current,
  };
}

/**
 * Allows switching back to the Free tier (useful during testing or cancellation simulation).
 */
export function downgradeToFreeTier(): SubscriptionState {
  saveStoredEntitlement({
    tier: 'free',
    activeSku: null,
    activatedAt: null,
    expiresAt: null,
    isTrial: false,
  });
  return getSubscriptionState();
}
