/**
 * 登录网站前端逻辑
 * - 登录 / 注册 标签切换
 * - 表单校验与提交
 * - 页面加载时自动检查登录状态
 */

(function () {
  'use strict';

  // ---------- 元素引用 ----------
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');
  const messageEl = document.getElementById('message');

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  const loginBtn = document.getElementById('login-btn');
  const registerBtn = document.getElementById('register-btn');

  // ---------- 消息提示 ----------
  let messageTimer = null;

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = 'message ' + (type === 'error' ? 'error' : 'success');
    messageEl.hidden = false;
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => {
      messageEl.hidden = true;
    }, 4000);
  }

  // ---------- 标签切换 ----------
  function switchTab(name) {
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    panels.forEach((panel) => panel.classList.remove('active'));

    const target = {
      login: loginForm,
      register: registerForm,
    }[name];
    target.classList.add('active');

    // 切换时清空消息
    messageEl.hidden = true;
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // ---------- 表单工具 ----------
  function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.textContent = loading ? '请稍候…' : btn.dataset.original;
  }

  [loginBtn, registerBtn].forEach((btn) => {
    btn.dataset.original = btn.textContent;
  });

  function fieldValue(id) {
    return document.getElementById(id).value.trim();
  }

  // ---------- 请求封装 ----------
  async function api(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  // ---------- 登录 ----------
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = fieldValue('login-username');
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('remember').checked;

    if (!username || !password) {
      showMessage('请输入用户名和密码', 'error');
      return;
    }

    setLoading(loginBtn, true);
    try {
      const { ok, data } = await api('/api/login', { username, password, remember });
      if (ok) {
        showMessage('登录成功，正在跳转…', 'success');
        const target = data.role === 'admin' ? '/admin.html' : '/welcome.html';
        setTimeout(() => {
          window.location.href = target;
        }, 600);
      } else {
        showMessage(data.error || '登录失败，请重试', 'error');
      }
    } catch {
      showMessage('网络错误，无法连接服务器', 'error');
    } finally {
      setLoading(loginBtn, false);
    }
  });

  // ---------- 注册 ----------
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = fieldValue('reg-username');
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/.test(username)) {
      showMessage('用户名需为 2-20 位，只能包含字母、数字、下划线或中文', 'error');
      return;
    }
    if (password.length < 6) {
      showMessage('密码至少需要 6 位', 'error');
      return;
    }
    if (password !== confirm) {
      showMessage('两次输入的密码不一致', 'error');
      return;
    }

    setLoading(registerBtn, true);
    try {
      const { ok, data } = await api('/api/register', { username, password });
      if (ok) {
        showMessage('注册成功！请使用新账号登录', 'success');
        // 清空注册表单并切回登录页
        registerForm.reset();
        switchTab('login');
        document.getElementById('login-username').value = username;
      } else {
        showMessage(data.error || '注册失败，请重试', 'error');
      }
    } catch {
      showMessage('网络错误，无法连接服务器', 'error');
    } finally {
      setLoading(registerBtn, false);
    }
  });

  // ---------- 页面加载时检查登录状态 ----------
  (async function checkSession() {
    try {
      const res = await fetch('/api/me', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.role === 'admin' ? '/admin.html' : '/welcome.html';
      }
    } catch {
      // 服务器不可达时留在登录页
    }
  })();
})();
