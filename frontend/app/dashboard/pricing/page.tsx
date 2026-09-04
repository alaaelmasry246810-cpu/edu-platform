"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { dictionaries } from "@/lib/i18n/dictionaries";

const COLOR_MAP: Record<string, { bg: string; border: string; btn: string; badge: string }> = {
  slate:  { bg: "bg-slate-50 dark:bg-slate-900",   border: "border-slate-200 dark:border-slate-700", btn: "bg-slate-200 text-slate-500 cursor-not-allowed", badge: "bg-slate-100 text-slate-600" },
  blue:   { bg: "bg-blue-50 dark:bg-blue-950/30",   border: "border-blue-300 dark:border-blue-700",   btn: "bg-blue-600 hover:bg-blue-700 text-white",       badge: "bg-blue-600 text-white" },
  purple: { bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-300 dark:border-purple-700", btn: "bg-purple-600 hover:bg-purple-700 text-white", badge: "bg-purple-600 text-white" },
};

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingPageInner />
    </Suspense>
  );
}

function PricingPageInner() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { t, dir, locale } = useI18n();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const pricingDict = dictionaries[locale].dashboard.pricing;

  const PLANS = [
    {
      id: "free",
      name: pricingDict.plans.free.name,
      price: { monthly: 0, yearly: 0 },
      color: "slate",
      features: pricingDict.plans.free.features,
      cta: pricingDict.plans.free.cta,
      disabled: true,
    },
    {
      id: "monthly",
      name: pricingDict.plans.monthly.name,
      price: { monthly: 49, yearly: 49 },
      currency: "ج.م",
      color: "blue",
      badge: pricingDict.plans.monthly.badge,
      features: pricingDict.plans.monthly.features,
      cta: pricingDict.plans.monthly.cta,
    },
    {
      id: "yearly",
      name: pricingDict.plans.yearly.name,
      price: { monthly: 399, yearly: 399 },
      currency: "ج.م",
      color: "purple",
      badge: pricingDict.plans.yearly.badge,
      features: pricingDict.plans.yearly.features,
      cta: pricingDict.plans.yearly.cta,
    },
  ];

  const FAQ = pricingDict.faq;

  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<{discount_percent: number; description?: string} | null>(null);
  const [couponError, setCouponError] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState(sessionId ? true : false);

  const currentPlan = user?.plan || "free";

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setCheckingCoupon(true);
    setCouponError("");
    setCouponResult(null);
    try {
      const r = await api.get(`/admin/coupons/validate/${couponCode.trim().toUpperCase()}`);
      setCouponResult(r.data);
    } catch (e: any) {
      setCouponError(e.response?.data?.detail || t("dashboard.pricing.couponInvalid"));
    } finally {
      setCheckingCoupon(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (planId === "free") return;
    setLoading(planId);
    try {
      const { data } = await api.post("/payments/checkout", {
        plan: planId,
        coupon_code: couponResult ? couponCode.trim().toUpperCase() : null,
        success_url: `${window.location.origin}/dashboard/pricing`,
        cancel_url: `${window.location.origin}/dashboard/pricing`,
      });
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (e: any) {
      alert(e.response?.data?.detail || t("dashboard.pricing.genericError"));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 py-12 px-4" dir={dir}>
      {/* Success banner */}
      {success && (
        <div className="max-w-2xl mx-auto mb-8 bg-green-50 dark:bg-green-900/30 border border-green-300 rounded-2xl p-5 text-center">
          <p className="text-2xl mb-1">🎉</p>
          <p className="font-bold text-green-800 dark:text-green-300">{t("dashboard.pricing.successBanner.title")}</p>
          <p className="text-green-600 dark:text-green-400 text-sm mt-1">{t("dashboard.pricing.successBanner.subtitle")}</p>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">{t("dashboard.pricing.title")}</h1>
        <p className="text-slate-500 dark:text-slate-400">{t("dashboard.pricing.subtitle")}</p>
        {currentPlan !== "free" && (
          <div className="mt-3 inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-1.5 rounded-full text-sm">
            <span>✓</span>
            <span>{t("dashboard.pricing.currentPlan")} <strong>{currentPlan === "monthly" ? t("dashboard.pricing.plans.monthly.name") : t("dashboard.pricing.plans.yearly.name")}</strong></span>
            {user?.subscription_expires_at && (
              <span className="text-blue-500 text-xs">
                ({t("dashboard.pricing.expires")} {new Date(user.subscription_expires_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Plans grid */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {PLANS.map((plan) => {
          const colors = COLOR_MAP[plan.color];
          const isCurrent = currentPlan === plan.id;
          const isLoading = loading === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-6 flex flex-col transition-all ${colors.bg} ${colors.border} ${!plan.disabled ? "hover:shadow-xl hover:-translate-y-1" : ""}`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className={`absolute -top-3 right-6 px-3 py-1 rounded-full text-xs font-bold ${colors.badge}`}>
                  {plan.badge}
                </div>
              )}

              {/* Current indicator */}
              {isCurrent && (
                <div className="absolute -top-3 left-6 px-3 py-1 rounded-full text-xs font-bold bg-green-500 text-white">
                  {t("dashboard.pricing.currentBadge")}
                </div>
              )}

              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{plan.name}</h3>
              <div className="mb-4">
                {plan.price.monthly === 0 ? (
                  <span className="text-3xl font-black text-slate-800 dark:text-white">{t("dashboard.pricing.plans.free.name")}</span>
                ) : (
                  <div>
                    <span className="text-3xl font-black text-slate-800 dark:text-white">{plan.price.monthly}</span>
                    <span className="text-slate-500 text-sm mr-1">{plan.currency}{t("dashboard.pricing.perMonth")}</span>
                    {plan.id === "yearly" && (
                      <p className="text-xs text-slate-400 mt-1">{t("dashboard.pricing.billedYearly", { amount: plan.price.yearly, currency: plan.currency ?? "" })}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* Coupon discount preview */}
              {couponResult && plan.price.monthly > 0 && (
                <div className="mb-3 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg p-2 text-center">
                  <span className="text-green-600 text-sm font-medium">
                    {t("dashboard.pricing.afterDiscount", { amount: Math.round(plan.price.monthly * (1 - couponResult.discount_percent / 100)), currency: plan.currency ?? "" })}
                    <span className="text-green-400 text-xs mr-1">(-{couponResult.discount_percent}%)</span>
                  </span>
                </div>
              )}

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={plan.disabled || isCurrent || isLoading}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                  isCurrent
                    ? "bg-green-100 text-green-700 cursor-default"
                    : plan.disabled
                      ? colors.btn
                      : `${colors.btn} ${isLoading ? "opacity-75 cursor-wait" : ""}`
                }`}
              >
                {isLoading ? t("dashboard.pricing.processing") : isCurrent ? t("dashboard.pricing.currentBadge") : plan.cta}
              </button>
            </div>
          );
        })}
      </div>

      {/* Coupon section */}
      <div className="max-w-md mx-auto bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <h3 className="font-bold text-slate-800 dark:text-white mb-4 text-center">{t("dashboard.pricing.couponTitle")}</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); setCouponError(""); }}
            placeholder={t("dashboard.pricing.couponPlaceholder")}
            className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && validateCoupon()}
          />
          <button
            onClick={validateCoupon}
            disabled={checkingCoupon || !couponCode.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {checkingCoupon ? "..." : t("dashboard.pricing.couponCheck")}
          </button>
        </div>
        {couponResult && (
          <div className="mt-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
            <p className="text-green-700 dark:text-green-300 font-bold">{t("dashboard.pricing.couponValid", { percent: couponResult.discount_percent })}</p>
            {couponResult.description && (
              <p className="text-green-600 text-xs mt-1">{couponResult.description}</p>
            )}
          </div>
        )}
        {couponError && (
          <p className="mt-2 text-red-500 text-sm text-center">{couponError}</p>
        )}
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto mt-12">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white text-center mb-6">{t("dashboard.pricing.faqTitle")}</h2>
        <div className="space-y-4">
          {FAQ.map((item, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
              <p className="font-semibold text-slate-800 dark:text-white text-sm mb-1">{item.q}</p>
              <p className="text-slate-500 text-sm">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
