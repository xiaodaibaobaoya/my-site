/**
 * PWA 注册脚本：注册 Service Worker
 * 仅当页面运行在 localhost 或 HTTPS 环境下才生效（浏览器安全要求）
 * 在 App（WebView）内不注册——避免 WebView 中的 SW 缓存导致页面/接口异常
 */
(function () {
  'use strict';
  // App（WebView）内不注册 Service Worker，避免缓存干扰
  if (/wv|dsh-app|WebView/i.test(navigator.userAgent)) return;
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {
      // 注册失败（如非安全上下文）时静默忽略，不影响正常使用
    });
  });
})();
