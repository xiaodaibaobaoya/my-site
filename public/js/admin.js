/**
 * 后台管理系统逻辑
 * - 管理员鉴权（非管理员跳回前台）
 * - 仪表盘：统计卡片 / 柱状图 / 环形图 / 最近注册
 * - 用户管理：搜索、添加、禁用/启用、设为管理员、删除
 */
(function () {
  'use strict';

  // ---------- 工具 ----------
  let myUser = null;

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function formatTime(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.hidden = true; }, 2600);
  }

  async function api(path, options) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  // ---------- 视图切换 ----------
  const TITLES = { dashboard: '仪表盘', users: '用户管理', videos: '视频管理' };

  function switchView(name) {
    document.querySelectorAll('.nav-item[data-view]').forEach((el) => {
      el.classList.toggle('active', el.dataset.view === name);
    });
    $('view-dashboard').hidden = name !== 'dashboard';
    $('view-users').hidden = name !== 'users';
    $('view-videos').hidden = name !== 'videos';
    $('page-title').textContent = TITLES[name];
    $('sidebar').classList.remove('open');
    if (name === 'dashboard' && !window._statsLoaded) loadStats();
    if (name === 'users' && !window._usersLoaded) loadUsers();
    if (name === 'videos' && !window._videosLoaded) loadVideos();
  }

  document.querySelectorAll('.nav-item[data-view]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(el.dataset.view);
    });
  });

  $('menu-toggle').addEventListener('click', () => {
    $('sidebar').classList.toggle('open');
  });

  // ---------- 仪表盘 ----------
  function renderBarChart(days) {
    const max = Math.max(1, ...days.map((d) => d.count));
    const html = days
      .map((d, i) => `
        <div class="bar-col">
          <span class="bar-val">${d.count}</span>
          <div class="bar" style="height:${Math.max(4, (d.count / max) * 100)}%; animation-delay:${i * 0.06}s"></div>
          <span class="bar-label">${esc(d.label)}</span>
        </div>`)
      .join('');
    $('chart-bar').innerHTML = `<div class="bar-chart">${html}</div>`;
  }

  function renderDonut(stats) {
    const total = stats.totalUsers || 1;
    const adminPct = Math.round((stats.adminCount / total) * 100);
    const userPct = 100 - adminPct;
    const r = 70;
    const c = 2 * Math.PI * r;
    const dash = (c * adminPct) / 100;
    $('chart-donut').innerHTML = `
      <div class="donut-wrap">
        <svg viewBox="0 0 180 180">
          <defs>
            <linearGradient id="donutGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#ff8fb8"/>
              <stop offset="100%" stop-color="#a78bfa"/>
            </linearGradient>
          </defs>
          <circle cx="90" cy="90" r="${r}" fill="none" stroke="#efe4ff" stroke-width="18"/>
          <circle cx="90" cy="90" r="${r}" fill="none" stroke="url(#donutGrad)" stroke-width="18"
            stroke-linecap="round" stroke-dasharray="${dash} ${c}" transform="rotate(-90 90 90)"/>
        </svg>
        <div class="donut-center">
          <div class="num">${adminPct}%</div>
          <div class="label">管理员占比</div>
        </div>
        <div class="donut-legend">
          <span class="legend-admin">管理员 ${stats.adminCount}</span>
          <span class="legend-user">普通用户 ${total - stats.adminCount}</span>
        </div>
      </div>`;
  }

  function renderRecent(users) {
    if (!users.length) {
      $('recent-list').innerHTML = '<p class="table-empty">暂无用户</p>';
      return;
    }
    $('recent-list').innerHTML = users
      .map((u) => `
        <div class="recent-row">
          <div class="recent-avatar">${esc(u.username.charAt(0).toUpperCase())}</div>
          <div class="recent-info">
            <div class="recent-name">${esc(u.username)}
              ${u.role === 'admin' ? '<span class="role-badge role-admin">管理员</span>' : ''}
            </div>
            <div class="recent-time">注册于 ${formatTime(u.createdAt)}</div>
          </div>
          ${u.status === 'disabled' ? '<span class="status-badge status-disabled">已禁用</span>' : ''}
        </div>`)
      .join('');
  }

  async function loadStats() {
    const { ok, data } = await api('/api/admin/stats');
    if (!ok) return;
    window._statsLoaded = true;
    $('stat-total').textContent = data.totalUsers;
    $('stat-today').textContent = data.todayNew;
    $('stat-admin').textContent = data.adminCount;
    $('stat-disabled').textContent = data.disabledCount;
    renderBarChart(data.last7days);
    renderDonut(data);
    renderRecent(data.recentUsers);
  }

  // ---------- 用户管理 ----------
  let searchTimer = null;

  $('user-search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadUsers, 250);
  });

  async function loadUsers() {
    const q = encodeURIComponent($('user-search').value.trim());
    const { ok, data } = await api(`/api/admin/users?q=${q}`);
    if (!ok) return;
    window._usersLoaded = true;
    const tbody = $('user-tbody');
    if (!data.users.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">没有找到用户</td></tr>';
      return;
    }
    tbody.innerHTML = data.users
      .map((u) => {
        const isSelf = myUser && u.id === myUser.id;
        const roleBadge = u.role === 'admin'
          ? '<span class="role-badge role-admin">管理员</span>'
          : '<span class="role-badge role-user">普通用户</span>';
        const statusBadge = u.status === 'active'
          ? '<span class="status-badge status-active">正常</span>'
          : '<span class="status-badge status-disabled">已禁用</span>';

        let actions = '';
        if (isSelf) {
          actions = '<span class="u-id">当前账号</span>';
        } else {
          const toggleText = u.status === 'active' ? '禁用' : '启用';
          const toggleCls = u.status === 'active' ? 'danger' : 'disabled-btn';
          actions = `
            <button class="row-btn" data-act="toggle" data-id="${u.id}" data-status="${u.status}">${toggleText}</button>
            ${u.role === 'user' ? `<button class="row-btn" data-act="promote" data-id="${u.id}">设为管理员</button>` : ''}
            ${u.role === 'user' ? `<button class="row-btn danger" data-act="delete" data-id="${u.id}" data-name="${esc(u.username)}">删除</button>` : ''}`;
        }

        return `
          <tr>
            <td>
              <div class="user-cell">
                <div class="u-avatar">${esc(u.username.charAt(0).toUpperCase())}</div>
                <div>
                  <div class="u-name">${esc(u.username)}</div>
                  <div class="u-id">${u.id.slice(0, 8)}…</div>
                </div>
              </div>
            </td>
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td>${formatTime(u.createdAt)}</td>
            <td><div class="row-actions">${actions}</div></td>
          </tr>`;
      })
      .join('');
  }

  // 表格操作（事件委托）
  $('user-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('.row-btn');
    if (!btn) return;
    const { act, id, name } = btn.dataset;

    if (act === 'toggle') {
      const next = btn.dataset.status === 'active' ? 'disabled' : 'active';
      const { ok, data } = await api(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      toast(ok ? (next === 'disabled' ? '已禁用该账号' : '已启用该账号') : data.error || '操作失败');
      if (ok) loadUsers();
    }

    if (act === 'promote') {
      if (!confirm('确定将「' + name + '」设为管理员吗？')) return;
      const { ok, data } = await api(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin' }),
      });
      toast(ok ? '已设为管理员' : data.error || '操作失败');
      if (ok) loadUsers();
    }

    if (act === 'delete') {
      if (!confirm('确定删除用户「' + name + '」吗？该操作不可恢复！')) return;
      const { ok, data } = await api(`/api/admin/users/${id}`, { method: 'DELETE' });
      toast(ok ? '用户已删除' : data.error || '操作失败');
      if (ok) loadUsers();
    }
  });

  // ---------- 模态框 ----------
  function openModal(id) { $(id).hidden = false; }
  function closeModal(id) { $(id).hidden = true; }

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  document.querySelectorAll('.modal-mask').forEach((mask) => {
    mask.addEventListener('click', (e) => {
      if (e.target === mask) mask.hidden = true;
    });
  });

  // 添加用户
  $('btn-add-user').addEventListener('click', () => {
    $('form-add').reset();
    openModal('modal-add');
    setTimeout(() => $('add-username').focus(), 50);
  });

  $('form-add').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('add-username').value.trim();
    const password = $('add-password').value.trim();
    const role = $('add-role').value;
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/.test(username)) {
      toast('用户名格式不正确（2-20 位）');
      return;
    }
    if (password.length < 6) {
      toast('密码至少需要 6 位');
      return;
    }
    const btn = $('btn-add-submit');
    btn.disabled = true;
    const { ok, data } = await api('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });
    btn.disabled = false;
    toast(ok ? '用户添加成功' : data.error || '添加失败');
    if (ok) {
      closeModal('modal-add');
      loadUsers();
      window._statsLoaded = false;
    }
  });

  // ---------- 视频管理 ----------
  async function loadVideos() {
    const { ok, data } = await api('/api/videos');
    if (!ok) return;
    window._videosLoaded = true;
    const list = $('video-admin-list');
    if (!data.videos.length) {
      list.innerHTML = '<p class="table-empty">暂无视频，点击右上角"添加视频"吧～</p>';
      return;
    }
    list.innerHTML = data.videos
      .map((v) => {
        const isExt = v.type === 'external';
        const badgeCls = v.type === 'file' ? 'file' : v.type === 'external' ? 'ext' : 'url';
        const badgeText = v.type === 'file' ? '本站视频' : v.type === 'external' ? '外链' : '网络视频';
        const previewHref = isExt ? esc(v.url) : `/video-play.html?id=${encodeURIComponent(v.id)}`;
        const previewTarget = isExt ? ' target="_blank" rel="noopener"' : '';
        return `
        <div class="video-admin-row">
          <div class="video-admin-thumb">
            <span>${isExt ? '🔗' : '🎬'}</span>
            ${isExt ? '' : `<video src="${esc(v.url)}" preload="metadata" muted playsinline></video>`}
          </div>
          <div class="video-admin-info">
            <div class="video-admin-title">${esc(v.title)}</div>
            <div class="video-admin-meta">
              <span class="type-badge ${badgeCls}">${badgeText}</span>
              <span>${v.addedBy === 'system' ? '系统预置' : esc(v.addedBy)}</span>
              <span>${formatTime(v.createdAt)}</span>
            </div>
          </div>
          <a class="video-admin-preview" href="${previewHref}"${previewTarget}>${isExt ? '打开 ▶' : '预览 ▶'}</a>
          <div class="row-actions">
            <button class="row-btn danger" data-video-delete="${v.id}" data-vtitle="${esc(v.title)}">删除</button>
          </div>
        </div>`;
      })
      .join('');

    // 缩略图取第一帧
    list.querySelectorAll('.video-admin-thumb video').forEach((video) => {
      const tryFrame = () => {
        try { if (video.readyState >= 1 && video.videoWidth > 0) video.currentTime = 0.1; } catch { /* 忽略 */ }
      };
      video.addEventListener('loadedmetadata', tryFrame);
      video.addEventListener('loadeddata', tryFrame);
      video.addEventListener('error', () => { video.remove(); });
    });
  }

  // 删除视频（事件委托）
  $('video-admin-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-video-delete]');
    if (!btn) return;
    if (!confirm('确定删除视频「' + btn.dataset.vtitle + '」吗？')) return;
    const { ok, data } = await api(`/api/admin/videos/${btn.dataset.videoDelete}`, { method: 'DELETE' });
    toast(ok ? '视频已删除' : data.error || '操作失败');
    if (ok) loadVideos();
  });

  // 添加视频：来源切换（视频链接 / 上传文件 / 外链跳转）
  function applyVtype(vtype) {
    const isFile = vtype === 'file';
    const isExt = vtype === 'external';
    $('video-url-field').hidden = isFile;
    $('video-file-field').hidden = !isFile;
    const label = $('video-url-label');
    const input = $('video-url');
    if (isExt) {
      label.textContent = '外链网址';
      input.placeholder = 'https://www.bilibili.com/video/...（点击卡片直接跳转）';
    } else {
      label.textContent = '视频链接';
      input.placeholder = 'https://example.com/video.mp4';
    }
  }

  document.querySelectorAll('input[name="vtype"]').forEach((radio) => {
    radio.addEventListener('change', () => applyVtype(radio.value));
  });

  $('btn-add-video').addEventListener('click', () => {
    $('form-video').reset();
    document.querySelector('input[name="vtype"][value="url"]').checked = true;
    applyVtype('url');
    openModal('modal-video');
    setTimeout(() => $('video-title').focus(), 50);
  });

  $('form-video').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = $('video-title').value.trim();
    const description = $('video-desc').value.trim();
    const category = $('video-cat').value;
    const vtype = document.querySelector('input[name="vtype"]:checked').value;
    const btn = $('btn-video-submit');

    if (!title) {
      toast('请输入视频标题');
      return;
    }

    btn.disabled = true;
    try {
      let result;
      if (vtype === 'url' || vtype === 'external') {
        const url = $('video-url').value.trim();
        if (!/^https?:\/\//i.test(url)) {
          toast('链接需以 http:// 或 https:// 开头');
          btn.disabled = false;
          return;
        }
        result = await api('/api/admin/videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, url, type: vtype, category }),
        });
      } else {
        const file = $('video-file').files[0];
        if (!file) {
          toast('请先选择视频文件');
          btn.disabled = false;
          return;
        }
        const fd = new FormData();
        fd.append('title', title);
        fd.append('description', description);
        fd.append('category', category);
        fd.append('video', file);
        const res = await fetch('/api/admin/videos/upload', {
          method: 'POST',
          credentials: 'same-origin',
          body: fd,
        });
        result = { ok: res.ok, data: await res.json().catch(() => ({})) };
      }
      toast(result.ok ? '视频添加成功' : result.data.error || '添加失败');
      if (result.ok) {
        closeModal('modal-video');
        loadVideos();
      }
    } catch {
      toast('网络错误，添加失败');
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- 退出登录 ----------
  $('btn-logout').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    window.location.href = '/index.html';
  });

  // ---------- 初始化：校验管理员身份 ----------
  (async function init() {
    const { ok, data } = await api('/api/me');
    if (!ok || data.role !== 'admin') {
      window.location.href = '/index.html';
      return;
    }
    myUser = { id: null, username: data.username };
    $('admin-name').textContent = data.username;
    document.title = '后台管理 · ' + data.username;
    // 拉取当前用户 id（用于表格"当前账号"标记）
    const r = await api('/api/admin/users');
    if (r.ok) {
      const me = r.data.users.find((u) => u.username === data.username);
      if (me) myUser.id = me.id;
    }
    loadStats();
  })();
})();
