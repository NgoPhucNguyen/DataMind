import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

function getLiveStatsUrl() {
  const rawBase = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
  const cleanBase = rawBase.replace(/\/+$/, "");
  return cleanBase.endsWith("/api/v1")
    ? `${cleanBase}/public/live-stats`
    : `${cleanBase}/api/v1/public/live-stats`;
}

export default function LiveStats() {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const locale = isEn ? "en-US" : "vi-VN";

  const [stats, setStats] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [serverWaking, setServerWaking] = useState(false);
  const [genericError, setGenericError] = useState(false);

  const retryCountRef = useRef(0);
  const pollTimerRef = useRef(null);
  const retryTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    document.title = t("seo.title_live_stats", "Số liệu trực tiếp — DataMind");
  }, [t, i18n.language]);

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  const fetchData = useCallback(async (isManual = false) => {
    clearTimers();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (isManual) {
      setIsRefreshing(true);
      retryCountRef.current = 0;
    }

    // 5-second timeout for server response
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 5000);

    try {
      const res = await fetch(getLiveStatsUrl(), {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP_${res.status}`);
      }

      const data = await res.json();
      setStats(data);
      setLastUpdated(new Date());
      setServerWaking(false);
      setGenericError(false);
      retryCountRef.current = 0;

      // Schedule next poll in 30 seconds if document is visible
      if (!document.hidden) {
        pollTimerRef.current = setTimeout(() => {
          fetchData(false);
        }, 30000);
      }
    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === "AbortError" || err instanceof TypeError) {
        // Request timed out (> 5s) or network connection failed
        setServerWaking(true);
        setGenericError(false);

        if (retryCountRef.current < 6) {
          retryCountRef.current += 1;
          if (!document.hidden) {
            retryTimerRef.current = setTimeout(() => {
              fetchData(false);
            }, 10000);
          }
        }
      } else {
        // Other HTTP 4xx / 5xx error
        setGenericError(true);
        setServerWaking(false);
      }
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
    }
  }, [clearTimers]);

  // Initial fetch and lifecycle timers
  useEffect(() => {
    fetchData(false);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimers();
      } else {
        fetchData(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimers();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchData, clearTimers]);

  const formatVnd = (num) => {
    const val = Number(num) || 0;
    return `${val.toLocaleString(locale)} ₫`;
  };

  const formatRate = (num) => {
    const val = Number(num) || 0;
    return `${val.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  };

  const formatTime = (dateObj) => {
    if (!dateObj) return "";
    return dateObj.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const formatPaidAt = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const datePart = d.toLocaleDateString(locale);
    const timePart = d.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return `${datePart} ${timePart}`;
  };

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans pb-16">
      <div className="px-4 md:px-8 max-w-7xl mx-auto w-full pt-8 md:pt-12">
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
          <div>
            <h1 className="text-2xl md:text-3xl font-sans font-bold text-ink leading-[1.3]">
              {t("liveStats.title", "Số liệu hoạt động trực tiếp")}
            </h1>
            <p className="text-sm text-muted mt-1 font-sans leading-normal">
              {t("liveStats.subtitle", "Thống kê thời gian thực từ cơ sở dữ liệu hệ thống DataMind.")}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {lastUpdated && (
              <span className="text-xs text-muted font-medium font-sans leading-normal">
                {t("liveStats.updated_at", "Cập nhật lúc")}: {formatTime(lastUpdated)}
              </span>
            )}
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-forest hover:bg-forest/90 disabled:opacity-50 rounded-lg transition-colors cursor-pointer font-sans leading-normal"
            >
              {isRefreshing ? t("liveStats.reloading", "Đang tải...") : t("liveStats.btn_reload", "Tải lại")}
            </button>
          </div>
        </div>

        {/* Notices: Server Waking / Error */}
        {serverWaking && (
          <div className="mt-6 p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-sm font-sans leading-relaxed">
            {t(
              "liveStats.server_restarting",
              "Máy chủ đang khởi động lại, có thể mất khoảng 1 phút. Số liệu sẽ tự cập nhật."
            )}
          </div>
        )}

        {genericError && (
          <div className="mt-6 p-4 rounded-xl border border-red-300 bg-red-50 text-red-900 text-sm font-sans leading-relaxed">
            {t(
              "liveStats.error_generic",
              "Không thể tải số liệu lúc này. Vui lòng thử lại sau."
            )}
          </div>
        )}

        {/* Initial loading skeleton */}
        {initialLoading ? (
          <div className="mt-8 space-y-8 animate-pulse">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 bg-sage/30 rounded-xl" />
              ))}
            </div>
            <div className="h-64 bg-sage/30 rounded-xl" />
            <div className="h-64 bg-sage/30 rounded-xl" />
          </div>
        ) : stats ? (
          <div className="mt-8 space-y-10">
            {/* (a) KPI Cards Row */}
            <section>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Users total */}
                <div className="p-4 bg-white border border-border rounded-xl">
                  <div className="text-xs font-semibold text-muted font-sans leading-normal">
                    {t("liveStats.kpi_users_total", "Người dùng")}
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-ink font-sans leading-[1.3] mt-2 type-number">
                    {(stats.totals?.users_total ?? 0).toLocaleString(locale)}
                  </div>
                </div>

                {/* Paying users */}
                <div className="p-4 bg-white border border-border rounded-xl">
                  <div className="text-xs font-semibold text-muted font-sans leading-normal">
                    {t("liveStats.kpi_paying_users", "Người trả phí")}
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-ink font-sans leading-[1.3] mt-2 type-number">
                    {(stats.totals?.paying_users ?? 0).toLocaleString(locale)}
                  </div>
                </div>

                {/* Completed transactions */}
                <div className="p-4 bg-white border border-border rounded-xl">
                  <div className="text-xs font-semibold text-muted font-sans leading-normal">
                    {t("liveStats.kpi_transactions_completed", "Giao dịch thành công")}
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-ink font-sans leading-[1.3] mt-2 type-number">
                    {(stats.totals?.transactions_completed ?? 0).toLocaleString(locale)}
                  </div>
                </div>

                {/* Revenue total */}
                <div className="p-4 bg-white border border-border rounded-xl">
                  <div className="text-xs font-semibold text-muted font-sans leading-normal">
                    {t("liveStats.kpi_revenue_total", "Doanh thu")}
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-forest font-sans leading-[1.3] mt-2 type-number">
                    {formatVnd(stats.totals?.revenue_total)}
                  </div>
                </div>

                {/* Average order value */}
                <div className="p-4 bg-white border border-border rounded-xl">
                  <div className="text-xs font-semibold text-muted font-sans leading-normal">
                    {t("liveStats.kpi_average_order_value", "Đơn trung bình")}
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-ink font-sans leading-[1.3] mt-2 type-number">
                    {formatVnd(stats.totals?.average_order_value)}
                  </div>
                </div>

                {/* Conversion rate */}
                <div className="p-4 bg-white border border-border rounded-xl">
                  <div className="text-xs font-semibold text-muted font-sans leading-normal">
                    {t("liveStats.kpi_conversion_rate", "Tỷ lệ chuyển đổi")}
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-ink font-sans leading-[1.3] mt-2 type-number">
                    {formatRate(stats.totals?.conversion_rate)}
                  </div>
                </div>
              </div>
            </section>

            {/* (b) By Channel Table */}
            <section className="bg-white border border-border rounded-xl p-5 md:p-6">
              <div className="mb-4">
                <h2 className="text-base md:text-lg font-bold text-ink font-sans leading-[1.3]">
                  {t("liveStats.channel_table_title", "Phân bổ theo kênh người dùng")}
                </h2>
              </div>

              <div className="overflow-x-auto -mx-5 px-5 md:-mx-6 md:px-6">
                <table className="w-full text-left text-sm min-w-[560px] font-sans">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted font-semibold leading-normal">
                      <th className="py-2.5 font-semibold font-sans leading-normal">{t("liveStats.col_channel", "Kênh")}</th>
                      <th className="py-2.5 font-semibold text-right font-sans leading-normal">{t("liveStats.col_users", "Người dùng")}</th>
                      <th className="py-2.5 font-semibold text-right font-sans leading-normal">{t("liveStats.col_paying_users", "Người trả phí")}</th>
                      <th className="py-2.5 font-semibold text-right font-sans leading-normal">{t("liveStats.col_revenue", "Doanh thu")}</th>
                      <th className="py-2.5 font-semibold text-right font-sans leading-normal">{t("liveStats.col_conversion_rate", "Tỷ lệ chuyển đổi")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {stats.by_channel && stats.by_channel.length > 0 ? (
                      stats.by_channel.map((row) => {
                        const userCount = Number(row.users) || 0;
                        const payingCount = Number(row.paying_users) || 0;
                        const convRate = userCount > 0 ? (payingCount / userCount) * 100 : 0;
                        return (
                          <tr key={row.channel} className="hover:bg-sage/20 transition-colors">
                            <td className="py-3 font-medium text-ink font-sans leading-normal">{row.channel}</td>
                            <td className="py-3 text-right text-muted font-sans leading-normal type-number">{userCount.toLocaleString(locale)}</td>
                            <td className="py-3 text-right text-muted font-sans leading-normal type-number">{payingCount.toLocaleString(locale)}</td>
                            <td className="py-3 text-right font-medium text-ink font-sans leading-normal type-number">{formatVnd(row.revenue)}</td>
                            <td className="py-3 text-right text-muted font-sans leading-normal type-number">{formatRate(convRate)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted font-sans leading-normal">
                          {t("liveStats.empty_channels", "Chưa có dữ liệu kênh.")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* (c) Recent Transactions Table */}
            <section className="bg-white border border-border rounded-xl p-5 md:p-6">
              <div className="mb-4">
                <h2 className="text-base md:text-lg font-bold text-ink font-sans leading-[1.3]">
                  {t("liveStats.recent_table_title", "Giao dịch thành công gần đây")}
                </h2>
              </div>

              <div className="overflow-x-auto -mx-5 px-5 md:-mx-6 md:px-6">
                <table className="w-full text-left text-sm min-w-[620px] font-sans">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted font-semibold leading-normal">
                      <th className="py-2.5 font-semibold font-sans leading-normal">{t("liveStats.col_time", "Thời gian")}</th>
                      <th className="py-2.5 font-semibold font-sans leading-normal">{t("liveStats.col_email", "Email")}</th>
                      <th className="py-2.5 font-semibold font-sans leading-normal">{t("liveStats.col_plan", "Gói")}</th>
                      <th className="py-2.5 font-semibold text-right font-sans leading-normal">{t("liveStats.col_amount", "Số tiền")}</th>
                      <th className="py-2.5 font-semibold font-sans leading-normal">{t("liveStats.col_method", "Phương thức")}</th>
                      <th className="py-2.5 font-semibold text-right font-sans leading-normal">{t("liveStats.col_order_ref", "Mã đơn")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {stats.recent_transactions && stats.recent_transactions.length > 0 ? (
                      stats.recent_transactions.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-sage/20 transition-colors">
                          <td className="py-3 text-muted text-xs whitespace-nowrap font-sans leading-normal type-number">{formatPaidAt(tx.paid_at)}</td>
                          <td className="py-3 font-mono text-xs text-ink leading-normal">{tx.masked_email}</td>
                          <td className="py-3 text-xs font-medium text-ink font-sans leading-normal">{tx.plan}</td>
                          <td className="py-3 text-right font-medium text-forest font-sans leading-normal type-number">{formatVnd(tx.amount)}</td>
                          <td className="py-3 text-xs text-muted font-sans leading-normal">{tx.payment_method}</td>
                          <td className="py-3 text-right font-mono text-xs text-muted leading-normal">{tx.order_ref_masked}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-muted font-sans leading-normal">
                          {t("liveStats.empty_transactions", "Chưa có giao dịch nào.")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

