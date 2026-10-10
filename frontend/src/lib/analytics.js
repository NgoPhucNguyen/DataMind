const GA_ID = import.meta.env.VITE_GA_ID;

export function initAnalytics() {
  if (!GA_ID || window.__ga_inited) return;
  window.__ga_inited = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

export function track(name, params = {}) {
  if (!GA_ID || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}

// Chỉ bắn 1 lần cho mỗi key trên trình duyệt này
export function trackOnce(key, name, params = {}) {
  try {
    const k = `ga_once_${key}`;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
  } catch { /* storage bị chặn: vẫn bắn */ }
  track(name, params);
}