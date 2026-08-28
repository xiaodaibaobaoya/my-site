/**
 * Service Worker —— 让网站像 App 一样：
 * - 预缓存核心页面与静态资源（秒开、可离线）
 * - 页面(HTML)走"网络优先"，保证每次都能拿到最新版本
 * - 静态资源走"stale-while-revalidate"：先给缓存，同时后台更新
 * - API 请求永不缓存（保证数据新鲜）
 * - 更新时清理旧缓存（版本号 +1 即触发全量刷新）
 */
const CACHE = 'dsh-app-v5';
const CORE = [
  '/',
  '/index.html',
  '/welcome.html',
  '/videos.html',
  '/video-play.html',
  '/admin.html',
  '/css/style.css',
  '/css/admin.css',
  '/js/app.js',
  '/js/admin.js',
  '/js/animations.js',
  '/js/pwa.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// 安装：预缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

// 激活：清理旧版本缓存，立即接管页面
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 请求拦截
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API 请求：永不缓存，直接走网络
  if (url.pathname.startsWith('/api/')) return;

  // 页面请求（HTML）：网络优先，失败回退缓存（离线可用）
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match('/index.html')))
    );
    return;
  }

  // 上传的视频文件：网络优先，回退缓存
  if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 其他静态资源：stale-while-revalidate（先缓存，后台更新）
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
        }
        return res;
      });
      return cached || network;
    })
  );
});
