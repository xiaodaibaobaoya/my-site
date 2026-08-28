/**
 * 飘落装饰动画：随机生成爱心 / 星星 / 花瓣，从屏幕顶部缓缓飘落
 * - 开场先铺一批，之后每 0.8 秒生成一个
 * - 30 秒后停止生成（页面上的会自然飘完并自动清理）
 * - 尊重系统"减少动态效果"设置（prefers-reduced-motion）
 */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var EMOJIS = ['💖', '💗', '💕', '✨', '⭐', '🌸', '🎀', '🩷', '🍓'];
  var spawned = 0;
  var MAX_ALIVE = 24;

  function spawn() {
    var el = document.createElement('div');
    el.className = 'falling';
    el.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.fontSize = 13 + Math.random() * 17 + 'px';
    el.style.animationDuration = 6 + Math.random() * 7 + 's';
    // 负延迟让元素从动画中途开始，避免所有元素同时起步
    el.style.animationDelay = -Math.random() * 6 + 's';

    document.body.appendChild(el);
    spawned++;

    var remove = function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      spawned--;
    };
    el.addEventListener('animationend', remove);
  }

  // 开场先铺一批
  for (var i = 0; i < 14; i++) spawn();

  var timer = setInterval(function () {
    if (spawned < MAX_ALIVE) spawn();
  }, 800);

  // 30 秒后停止生成新元素
  setTimeout(function () {
    clearInterval(timer);
  }, 30000);
})();
