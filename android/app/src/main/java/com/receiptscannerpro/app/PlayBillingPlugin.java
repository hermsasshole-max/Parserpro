package com.receiptscannerpro.app;

import android.app.Activity;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONException;

/**
 * Native Google Play Billing Library v8.3.0 Capacitor bridge for ParserPro (com.receiptscannerpro.app).
 * Supports:
 *  - parserpro_mid_monthly  (Base Plan: mid-monthly,  $1.99/mo)
 *  - parserpro_full_monthly (Base Plan: full-monthly, $3.99/mo, 7-day trial eligible)
 *  - Prorated subscription upgrades/switches & purchase restoration
 */
@CapacitorPlugin(name = "PlayBilling")
public class PlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private BillingClient billingClient;
    private PluginCall pendingPurchaseCall;
    private String pendingRequestedSku;

    @Override
    public void load() {
        super.load();
        initBillingClient();
    }

    private synchronized void initBillingClient() {
        if (billingClient == null && getContext() != null) {
            PendingPurchasesParams pendingParams = PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build();

            billingClient = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(pendingParams)
                .enableAutoServiceReconnection()
                .build();
        }
    }

    private void ensureConnected(final Runnable onConnected, final PluginCall callToFail) {
        initBillingClient();
        if (billingClient == null) {
            if (callToFail != null) {
                callToFail.reject("Google Play Billing client unavailable on this device.");
            }
            return;
        }
        if (billingClient.isReady()) {
            onConnected.run();
            return;
        }
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    onConnected.run();
                } else if (callToFail != null) {
                    JSObject fallback = new JSObject();
                    fallback.put("skuNotConfiguredYet", true);
                    fallback.put(
                        "message",
                        "Google Play Billing service unavailable (" + billingResult.getDebugMessage() + ")."
                    );
                    callToFail.resolve(fallback);
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Auto-reconnection is enabled via enableAutoServiceReconnection()
            }
        });
    }

    @PluginMethod
    public void isAvailable(final PluginCall call) {
        initBillingClient();
        if (billingClient == null) {
            JSObject ret = new JSObject();
            ret.put("available", false);
            call.resolve(ret);
            return;
        }
        if (billingClient.isReady()) {
            JSObject ret = new JSObject();
            ret.put("available", true);
            call.resolve(ret);
            return;
        }
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                JSObject ret = new JSObject();
                ret.put("available", billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK);
                call.resolve(ret);
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Handled automatically on subsequent calls
            }
        });
    }

    @PluginMethod
    public void queryProducts(final PluginCall call) {
        JSArray requestedIds = call.getArray("productIds");
        final List<String> skuList = new ArrayList<>();
        if (requestedIds != null) {
            for (int i = 0; i < requestedIds.length(); i++) {
                try {
                    String id = requestedIds.getString(i);
                    if (id != null && !id.trim().isEmpty()) {
                        skuList.add(id.trim());
                    }
                } catch (JSONException ignored) {}
            }
        }
        if (skuList.isEmpty()) {
            skuList.add("parserpro_mid_monthly");
            skuList.add("parserpro_full_monthly");
        }

        ensureConnected(() -> {
            List<QueryProductDetailsParams.Product> productList = new ArrayList<>();
            for (String sku : skuList) {
                productList.add(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(sku)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()
                );
            }

            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(productList)
                .build();

            billingClient.queryProductDetailsAsync(
                params,
                (BillingResult billingResult, QueryProductDetailsResult result) -> {
                    JSArray productsOut = new JSArray();
                    List<ProductDetails> detailsList =
                        result != null ? result.getProductDetailsList() : null;

                    if (
                        billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK &&
                        detailsList != null
                    ) {
                        for (ProductDetails pd : detailsList) {
                            JSObject item = new JSObject();
                            item.put("productId", pd.getProductId());
                            item.put("title", pd.getTitle());
                            item.put("description", pd.getDescription());

                            List<ProductDetails.SubscriptionOfferDetails> offers =
                                pd.getSubscriptionOfferDetails();
                            if (offers != null && !offers.isEmpty()) {
                                ProductDetails.SubscriptionOfferDetails offer = offers.get(0);
                                boolean hasFreeTrial = false;
                                String formattedPrice = "";
                                String currencyCode = "";

                                for (ProductDetails.PricingPhase phase : offer
                                    .getPricingPhases()
                                    .getPricingPhaseList()) {
                                    if (phase.getPriceAmountMicros() == 0) {
                                        hasFreeTrial = true;
                                    } else if (formattedPrice.isEmpty()) {
                                        formattedPrice = phase.getFormattedPrice();
                                        currencyCode = phase.getPriceCurrencyCode();
                                    }
                                }
                                item.put("formattedPrice", formattedPrice);
                                item.put("currencyCode", currencyCode);
                                item.put("hasFreeTrial", hasFreeTrial);
                                item.put("basePlanId", offer.getBasePlanId());
                            }
                            productsOut.put(item);
                        }
                    }

                    JSObject ret = new JSObject();
                    ret.put("products", productsOut);
                    call.resolve(ret);
                }
            );
        }, call);
    }

    @PluginMethod
    public void purchaseProduct(final PluginCall call) {
        final String productId = call.getString("productId", call.getString("productIdentifier", ""));
        final String requestedBasePlanId = call.getString("basePlanId", "");
        final String oldPurchaseToken = call.getString("oldPurchaseToken", "");

        if (productId == null || productId.trim().isEmpty()) {
            call.reject("Missing subscription productId.");
            return;
        }

        ensureConnected(() -> {
            List<QueryProductDetailsParams.Product> productList = new ArrayList<>();
            productList.add(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId.trim())
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build()
            );

            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(productList)
                .build();

            billingClient.queryProductDetailsAsync(
                params,
                (BillingResult billingResult, QueryProductDetailsResult result) -> {
                    List<ProductDetails> detailsList =
                        result != null ? result.getProductDetailsList() : null;

                    if (
                        billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK ||
                        detailsList == null ||
                        detailsList.isEmpty()
                    ) {
                        JSObject unconfigured = new JSObject();
                        unconfigured.put("skuNotConfiguredYet", true);
                        unconfigured.put(
                            "message",
                            "Subscription product '" +
                                productId +
                                "' is not yet active in Google Play Console."
                        );
                        call.resolve(unconfigured);
                        return;
                    }

                    ProductDetails productDetails = detailsList.get(0);
                    List<ProductDetails.SubscriptionOfferDetails> offers =
                        productDetails.getSubscriptionOfferDetails();
                    if (offers == null || offers.isEmpty()) {
                        JSObject noOffers = new JSObject();
                        noOffers.put("skuNotConfiguredYet", true);
                        noOffers.put(
                            "message",
                            "No active base plan found for '" + productId + "' in Play Console."
                        );
                        call.resolve(noOffers);
                        return;
                    }

                    ProductDetails.SubscriptionOfferDetails chosenOffer = offers.get(0);
                    if (requestedBasePlanId != null && !requestedBasePlanId.trim().isEmpty()) {
                        for (ProductDetails.SubscriptionOfferDetails candidate : offers) {
                            if (requestedBasePlanId.trim().equals(candidate.getBasePlanId())) {
                                chosenOffer = candidate;
                                // Prefer offer with a free trial phase when matching basePlanId
                                for (ProductDetails.PricingPhase phase : candidate
                                    .getPricingPhases()
                                    .getPricingPhaseList()) {
                                    if (phase.getPriceAmountMicros() == 0) {
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    Activity activity = getActivity();
                    if (activity == null) {
                        call.reject("Android Activity not available to launch Google Play checkout.");
                        return;
                    }

                    final ProductDetails.SubscriptionOfferDetails finalOffer = chosenOffer;
                    activity.runOnUiThread(() -> {
                        pendingPurchaseCall = call;
                        pendingRequestedSku = productId.trim();

                        List<BillingFlowParams.ProductDetailsParams> paramsList = new ArrayList<>();
                        paramsList.add(
                            BillingFlowParams.ProductDetailsParams.newBuilder()
                                .setProductDetails(productDetails)
                                .setOfferToken(finalOffer.getOfferToken())
                                .build()
                        );

                        BillingFlowParams.Builder flowBuilder = BillingFlowParams.newBuilder()
                            .setProductDetailsParamsList(paramsList);

                        if (oldPurchaseToken != null && !oldPurchaseToken.trim().isEmpty()) {
                            BillingFlowParams.SubscriptionUpdateParams updateParams =
                                BillingFlowParams.SubscriptionUpdateParams.newBuilder()
                                    .setOldPurchaseToken(oldPurchaseToken.trim())
                                    .setSubscriptionReplacementMode(
                                        BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.CHARGE_PRORATED_PRICE
                                    )
                                    .build();
                            flowBuilder.setSubscriptionUpdateParams(updateParams);
                        }

                        BillingResult launchResult = billingClient.launchBillingFlow(
                            activity,
                            flowBuilder.build()
                        );
                        if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                            PluginCall failedCall = pendingPurchaseCall;
                            pendingPurchaseCall = null;
                            if (failedCall != null) {
                                failedCall.reject(
                                    "Could not launch Google Play checkout: " +
                                        launchResult.getDebugMessage()
                                );
                            }
                        }
                    });
                }
            );
        }, call);
    }

    @PluginMethod
    public void restorePurchases(final PluginCall call) {
        ensureConnected(() -> {
            QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build();

            billingClient.queryPurchasesAsync(
                params,
                (BillingResult billingResult, List<Purchase> purchasesList) -> {
                    JSArray restoredArray = new JSArray();
                    if (
                        billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK &&
                        purchasesList != null
                    ) {
                        for (Purchase purchase : purchasesList) {
                            if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                acknowledgeIfNeeded(purchase, null);
                                JSObject item = new JSObject();
                                List<String> prods = purchase.getProducts();
                                item.put("productId", prods.isEmpty() ? "" : prods.get(0));
                                item.put("purchaseToken", purchase.getPurchaseToken());
                                item.put("orderId", purchase.getOrderId());
                                item.put("isAutoRenewing", purchase.isAutoRenewing());
                                restoredArray.put(item);
                            }
                        }
                    }
                    JSObject ret = new JSObject();
                    ret.put("purchases", restoredArray);
                    call.resolve(ret);
                }
            );
        }, call);
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        final PluginCall activeCall = pendingPurchaseCall;
        pendingPurchaseCall = null;

        int code = billingResult.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null && !purchases.isEmpty()) {
            Purchase latest = purchases.get(0);
            if (latest.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                acknowledgeIfNeeded(latest, () -> {
                    if (activeCall != null) {
                        JSObject out = new JSObject();
                        List<String> prods = latest.getProducts();
                        out.put(
                            "productId",
                            prods.isEmpty()
                                ? (pendingRequestedSku != null ? pendingRequestedSku : "")
                                : prods.get(0)
                        );
                        out.put("purchaseToken", latest.getPurchaseToken());
                        out.put("orderId", latest.getOrderId());
                        out.put("acknowledged", true);
                        activeCall.resolve(out);
                    }
                });
                return;
            }
            if (activeCall != null) {
                activeCall.reject("Your Google Play subscription payment is pending confirmation.");
            }
            return;
        }

        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            if (activeCall != null) {
                JSObject cancelled = new JSObject();
                cancelled.put("cancelled", true);
                activeCall.resolve(cancelled);
            }
            return;
        }

        if (activeCall != null) {
            activeCall.reject(
                "Google Play Billing error (" + code + "): " + billingResult.getDebugMessage()
            );
        }
    }

    private void acknowledgeIfNeeded(final Purchase purchase, final Runnable onDone) {
        if (purchase.isAcknowledged() || billingClient == null || !billingClient.isReady()) {
            if (onDone != null) {
                onDone.run();
            }
            return;
        }
        AcknowledgePurchaseParams ackParams = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken())
            .build();
        billingClient.acknowledgePurchase(ackParams, billingResult -> {
            if (onDone != null) {
                onDone.run();
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (billingClient != null) {
            try {
                billingClient.endConnection();
            } catch (Exception ignored) {}
            billingClient = null;
        }
        super.handleOnDestroy();
    }
}
