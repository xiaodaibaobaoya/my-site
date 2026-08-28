/**
 * 登录网站 + 后台管理系统 + 视频中心后端（零依赖，纯 Node.js 内置模块）
 *
 * 功能：
 *  - 用户注册 / 登录 / 会话
 *  - 管理员角色（role: admin | user）、账号禁用（status: active | disabled）
 *  - 内置管理员账号：admin / admin123（首次启动自动创建）
 *  - 后台 API：仪表盘统计、用户管理（列表/搜索/添加/禁用/删除）
 *  - 视频中心：视频列表（登录可看）、管理员添加（链接 / 上传文件）、删除
 *  - 预置开源动画片：大雄兔 / 辛特尔 / 大象之梦
 *
 * 运行：node server.js   （默认端口 3000，可用 PORT 环境变量修改）
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads', 'videos');
// 上传视频大小上限：100 MB
const MAX_UPLOAD = 100 * 1024 * 1024;
// 允许的视频扩展名
const VIDEO_EXT = ['.mp4', '.webm', '.ogv', '.ogg'];

// ------------------------- 数据存储（JSON 文件） -------------------------

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
  if (!fs.existsSync(SESSIONS_FILE)) fs.writeFileSync(SESSIONS_FILE, '[]');
  if (!fs.existsSync(VIDEOS_FILE)) fs.writeFileSync(VIDEOS_FILE, '[]');
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 预置开源动画片（公开测试视频直链，已在本环境验证可访问）
function ensureVideos() {
  const videos = readJSON(VIDEOS_FILE);
  if (videos.length > 0) return;
  const now = new Date().toISOString();
  const seeds = [
    {
      title: '🐰 大雄兔 Big Buck Bunny',
      description: 'Blender 基金会出品的开源动画电影：一只温柔的大兔子用恶作剧教训三只捣蛋的小动物，画风可爱，全程无对白。（10 秒节选）',
      type: 'url',
      url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
    },
    {
      title: '🧚 辛特尔 Sintel',
      description: 'Blender 基金会的开源动画短片：少女辛特尔为找回小龙幼崽踏上艰难旅程，画面唯美、故事动人。（10 秒节选）',
      type: 'url',
      url: 'https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4',
    },
    {
      title: '🎬 大雄兔 · 官方预告片',
      description: '《大雄兔 Big Buck Bunny》官方预告片（W3C 公开测试视频）：短小精悍，30 秒感受这只温柔大兔子的可爱日常。',
      type: 'url',
      url: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
    },
    {
      title: '🐻 熊出没·狂野大陆（B站）',
      description: '熊出没大电影系列（正版平台外链）：点击卡片跳转到 B 站观看完整版。',
      type: 'external',
      url: 'https://www.bilibili.com/video/BV15iu1zZEgP/',
    },
    {
      title: '🐻 熊出没·重启未来（B站）',
      description: '熊出没大电影（正版平台外链）：点击卡片跳转到 B 站观看完整版。',
      type: 'external',
      url: 'https://www.bilibili.com/video/BV1a8PSzDEAo/',
    },
    {
      title: '🐻 熊出没之变形记（B站）',
      description: '熊出没大电影（正版平台外链）：点击卡片跳转到 B 站观看完整版。',
      type: 'external',
      url: 'https://www.bilibili.com/video/BV1kkoZYUEEh/',
    },
  ];
  seeds.forEach((v, i) => {
    videos.push({
      id: crypto.randomUUID(),
      title: v.title,
      description: v.description,
      type: v.type,
      url: v.url,
      addedBy: 'system',
      createdAt: new Date(Date.parse(now) + i * 1000).toISOString(),
    });
  });
  writeJSON(VIDEOS_FILE, videos);
  console.log(`已预置 ${seeds.length} 部开源动画片`);
}

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeJSON(file, data) {
  // 先写临时文件再重命名，避免中途崩溃损坏数据
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function getUsers() {
  // 兼容旧数据：缺失的字段给默认值
  return readJSON(USERS_FILE).map((u) => ({
    role: 'user',
    status: 'active',
    ...u,
  }));
}

function getSessions() {
  return readJSON(SESSIONS_FILE);
}

function saveSessions(sessions) {
  writeJSON(SESSIONS_FILE, sessions);
}

function saveUsers(users) {
  writeJSON(USERS_FILE, users);
}

// 剔除敏感字段，返回给前端
function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    passwordResetAt: u.passwordResetAt || null,
  };
}

// ------------------------- 内置管理员 -------------------------

function ensureAdmin() {
  const users = getUsers();
  if (!users.some((u) => u.role === 'admin')) {
    const { salt, hash } = hashPassword('admin123');
    users.push({
      id: crypto.randomUUID(),
      username: 'admin',
      passwordHash: hash,
      salt,
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
    });
    saveUsers(users);
    console.log('已创建内置管理员账号：admin / admin123');
  }
}

// ------------------------- 密码与安全 -------------------------

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  // 恒定时间比较，防止时序攻击
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 会话有效期：记住我 = 7 天，不记住 = 2 小时
const REMEMBER_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_MS = 2 * 60 * 60 * 1000;

const COOKIE_NAME = 'dsh_login';

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      cookies[key] = decodeURIComponent(value);
    }
  });
  return cookies;
}

function createSession(username, remember) {
  const sessions = getSessions();
  const token = generateToken();
  const now = Date.now();
  sessions.push({
    token,
    username,
    createdAt: now,
    expiresAt: now + (remember ? REMEMBER_MS : SESSION_MS),
    remember: !!remember,
  });
  saveSessions(sessions);
  return token;
}

function findValidSession(token) {
  if (!token) return null;
  const sessions = getSessions();
  const now = Date.now();
  // 顺手清理过期会话
  const valid = sessions.filter((s) => s.expiresAt > now);
  if (valid.length !== sessions.length) saveSessions(valid);
  return valid.find((s) => s.token === token) || null;
}

function destroySession(token) {
  const sessions = getSessions();
  saveSessions(sessions.filter((s) => s.token !== token));
}

function destroyUserSessions(username) {
  const sessions = getSessions();
  saveSessions(sessions.filter((s) => s.username !== username));
}

// 清理所有过期会话（启动时调用一次）
function cleanupSessions() {
  const sessions = getSessions();
  const now = Date.now();
  const valid = sessions.filter((s) => s.expiresAt > now);
  if (valid.length !== sessions.length) saveSessions(valid);
}

// ------------------------- 校验规则 -------------------------

function validateUsername(username) {
  if (typeof username !== 'string') return '用户名格式不正确';
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/.test(username)) {
    return '用户名需为 2-20 位，只能包含字母、数字、下划线或中文';
  }
  return null;
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 6) {
    return '密码至少需要 6 位';
  }
  if (password.length > 64) return '密码不能超过 64 位';
  return null;
}

// ------------------------- HTTP 工具 -------------------------

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('请求体不是有效的 JSON'));
      }
    });
    req.on('error', reject);
  });
}

// 登录鉴权（任意已登录用户）：返回会话，失败时已发送响应并返回 null
function requireLogin(req, res) {
  const token = parseCookies(req)[COOKIE_NAME];
  const session = findValidSession(token);
  if (!session) {
    sendJSON(res, 401, { error: '未登录或会话已过期' });
    return null;
  }
  const user = getUsers().find((u) => u.username === session.username);
  if (!user || user.status === 'disabled') {
    destroySession(token);
    sendJSON(res, 403, { error: '账号已被禁用' });
    return null;
  }
  req.user = user;
  req.session = session;
  return session;
}

// 管理员鉴权：返回会话，失败时已发送响应并返回 null
function requireAdmin(req, res) {
  const session = requireLogin(req, res);
  if (!session) return null;
  if (req.user.role !== 'admin') {
    sendJSON(res, 403, { error: '无管理员权限' });
    return null;
  }
  return session;
}

// ------------------------- 统计辅助 -------------------------

function formatDate(d) {
  const date = new Date(d);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${day}`;
}

function last7DaysStats(users) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: formatDate(d),
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      count: 0,
    });
  }
  users.forEach((u) => {
    const key = formatDate(u.createdAt);
    const day = days.find((x) => x.date === key);
    if (day) day.count++;
  });
  return days;
}

// ------------------------- 静态文件服务 -------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.ogg': 'video/ogg',
  '.apk': 'application/vnd.android.package-archive',
};

// 解析 multipart/form-data 请求（支持字段 + 单个文件上传）
function parseMultipart(req, maxSize) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const m = contentType.match(/boundary=(.+)$/);
    if (!m) {
      reject(new Error('请求格式错误：缺少 boundary'));
      return;
    }
    const boundary = '--' + m[1].trim();
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        reject(new Error('文件过大，上限 100MB'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const buf = Buffer.concat(chunks);
        const parts = buf.toString('latin1').split(boundary);
        const fields = {};
        let filename = null;
        let fileBuffer = null;

        for (const part of parts) {
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd === -1) continue;
          const header = part.slice(0, headerEnd);
          const body = part.slice(headerEnd + 4);

          const fn = /filename="([^"]*)"/.exec(header);
          if (fn) {
            filename = fn[1];
            // 去掉结尾的 \r\n（boundary 前的换行）
            fileBuffer = Buffer.from(body.replace(/\r\n$/, ''), 'latin1');
          } else {
            const nameMatch = /name="([^"]+)"/.exec(header);
            if (nameMatch) {
              // 字段值是 UTF-8 编码的字节，需按 latin1 还原字节后再转 UTF-8
              fields[nameMatch[1]] = Buffer.from(body.replace(/\r\n$/, ''), 'latin1').toString('utf8').trim();
            }
          }
        }
        resolve({ fields, filename, fileBuffer });
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // 防目录穿越
  let filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJSON(res, 403, { error: '禁止访问' });
    return;
  }

  // 无扩展名的路径自动补 .html（如 /admin → /admin.html，/videos → /videos.html）
  if (!path.extname(filePath) && !fs.existsSync(filePath)) {
    filePath += '.html';
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      // 友好 404 页面（显示访问的路径，便于排查）
      const reqPath = (req.url || '/').split('?')[0];
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>404 页面不存在</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:linear-gradient(135deg,#ffe9f2,#f9e8ff,#e8e4ff);color:#6d4a5e}
  .box{text-align:center;background:rgba(255,255,255,.65);backdrop-filter:blur(16px);
    border:1.5px solid rgba(255,255,255,.9);border-radius:24px;padding:44px 52px;box-shadow:0 20px 50px rgba(255,107,157,.18);max-width:520px}
  .code{font-size:60px;font-weight:800;background:linear-gradient(90deg,#ff6b9d,#a78bfa,#ff6b9d);
    background-size:200% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:flow 3s linear infinite}
  @keyframes flow{to{background-position:200% center}}
  p{font-size:15px;color:#a58ba0;margin:12px 0 8px}
  .path{display:inline-block;font-size:13px;color:#e75480;background:#ffe0ec;border-radius:8px;padding:4px 12px;margin-bottom:18px;word-break:break-all}
  a{display:inline-block;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;color:#fff;
    background:linear-gradient(135deg,#ff6b9d,#a78bfa);box-shadow:0 8px 20px rgba(255,107,157,.35)}
</style>
</head>
<body><div class="box"><div class="code">404</div><p>页面不存在或已被移除</p>
<div class="path">访问地址：${reqPath.replace(/[<>&"]/g, '')}</div>
<a href="/">🏠 返回首页</a></div></body>
</html>`);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    // Service Worker 与 manifest 必须实时更新，禁止浏览器缓存
    const base = path.basename(filePath);
    if (base === 'sw.js' || base === 'manifest.json') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    }
    res.writeHead(200, headers);
    res.end(content);
  });
}

// ------------------------- 路由处理 -------------------------

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const method = req.method;

  try {
    // ================= 公开 API =================

    if (url === '/api/register' && method === 'POST') {
      const body = await readBody(req);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');

      let err = validateUsername(username);
      if (!err) err = validatePassword(password);
      if (err) return sendJSON(res, 400, { error: err });

      const users = getUsers();
      if (users.some((u) => u.username === username)) {
        return sendJSON(res, 409, { error: '该用户名已被注册' });
      }

      const { salt, hash } = hashPassword(password);
      users.push({
        id: crypto.randomUUID(),
        username,
        passwordHash: hash,
        salt,
        role: 'user',
        status: 'active',
        createdAt: new Date().toISOString(),
      });
      saveUsers(users);
      return sendJSON(res, 201, { message: '注册成功，请登录' });
    }

    if (url === '/api/login' && method === 'POST') {
      const body = await readBody(req);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      const remember = !!body.remember;

      const users = getUsers();
      const user = users.find((u) => u.username === username);
      if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
        return sendJSON(res, 401, { error: '用户名或密码错误' });
      }
      if (user.status === 'disabled') {
        return sendJSON(res, 403, { error: '该账号已被禁用，请联系管理员' });
      }

      const token = createSession(username, remember);
      const maxAge = remember ? REMEMBER_MS : SESSION_MS;
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${Math.floor(maxAge / 1000)}; SameSite=Lax`,
      });
      res.end(JSON.stringify({ message: '登录成功', username, role: user.role }));
      return;
    }

    if (url === '/api/me' && method === 'GET') {
      const token = parseCookies(req)[COOKIE_NAME];
      const session = findValidSession(token);
      if (!session) return sendJSON(res, 401, { error: '未登录或会话已过期' });
      const user = getUsers().find((u) => u.username === session.username);
      if (!user || user.status === 'disabled') {
        destroySession(token);
        return sendJSON(res, 403, { error: '账号已被禁用' });
      }
      return sendJSON(res, 200, { username: user.username, role: user.role });
    }

    if (url === '/api/logout' && method === 'POST') {
      const token = parseCookies(req)[COOKIE_NAME];
      if (token) destroySession(token);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
      });
      res.end(JSON.stringify({ message: '已退出登录' }));
      return;
    }

    // ---- 视频列表（任意登录用户可看） ----
    if (url === '/api/videos' && method === 'GET') {
      const session = requireLogin(req, res);
      if (!session) return;
      const videos = readJSON(VIDEOS_FILE).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return sendJSON(res, 200, { videos });
    }

    // ================= 后台管理 API（需管理员） =================

    if (url.startsWith('/api/admin/')) {
      const session = requireAdmin(req, res);
      if (!session) return;

      // ---- 仪表盘统计 ----
      if (url === '/api/admin/stats' && method === 'GET') {
        const users = getUsers();
        const now = new Date().toISOString();
        const stats = {
          totalUsers: users.length,
          adminCount: users.filter((u) => u.role === 'admin').length,
          todayNew: users.filter((u) => formatDate(u.createdAt) === formatDate(now)).length,
          disabledCount: users.filter((u) => u.status === 'disabled').length,
          last7days: last7DaysStats(users),
          recentUsers: users
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5)
            .map(publicUser),
        };
        return sendJSON(res, 200, stats);
      }

      // ---- 用户列表（支持 ?q= 搜索） ----
      if (url === '/api/admin/users' && method === 'GET') {
        const query = new URLSearchParams(req.url.split('?')[1] || '');
        const q = (query.get('q') || '').toLowerCase();
        let users = getUsers().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (q) users = users.filter((u) => u.username.toLowerCase().includes(q));
        return sendJSON(res, 200, { users: users.map(publicUser) });
      }

      // ---- 添加用户 ----
      if (url === '/api/admin/users' && method === 'POST') {
        const body = await readBody(req);
        const username = String(body.username || '').trim();
        const password = String(body.password || '');
        const role = body.role === 'admin' ? 'admin' : 'user';

        let err = validateUsername(username);
        if (!err) err = validatePassword(password);
        if (err) return sendJSON(res, 400, { error: err });

        const users = getUsers();
        if (users.some((u) => u.username === username)) {
          return sendJSON(res, 409, { error: '该用户名已存在' });
        }

        const { salt, hash } = hashPassword(password);
        users.push({
          id: crypto.randomUUID(),
          username,
          passwordHash: hash,
          salt,
          role,
          status: 'active',
          createdAt: new Date().toISOString(),
        });
        saveUsers(users);
        return sendJSON(res, 201, { message: '用户添加成功' });
      }

      // ---- 修改用户（状态 / 角色） ----
      if (/^\/api\/admin\/users\/[^/]+\/?$/.test(url) && method === 'PATCH') {
        const id = decodeURIComponent(url.split('/').pop());
        const body = await readBody(req);
        const users = getUsers();
        const target = users.find((u) => u.id === id);
        if (!target) return sendJSON(res, 404, { error: '用户不存在' });
        if (target.id === req.user.id) {
          return sendJSON(res, 400, { error: '不能修改自己的账号' });
        }

        if (body.status !== undefined) {
          if (!['active', 'disabled'].includes(body.status)) {
            return sendJSON(res, 400, { error: '无效的状态值' });
          }
          target.status = body.status;
          if (body.status === 'disabled') destroyUserSessions(target.username);
        }

        if (body.role !== undefined) {
          if (!['user', 'admin'].includes(body.role)) {
            return sendJSON(res, 400, { error: '无效的角色值' });
          }
          if (target.role === 'admin' && body.role === 'user') {
            const adminCount = users.filter((u) => u.role === 'admin').length;
            if (adminCount <= 1) {
              return sendJSON(res, 400, { error: '系统至少需要保留一名管理员' });
            }
          }
          target.role = body.role;
        }

        saveUsers(users);
        return sendJSON(res, 200, { message: '更新成功', user: publicUser(target) });
      }

      // ---- 删除用户 ----
      if (/^\/api\/admin\/users\/[^/]+\/?$/.test(url) && method === 'DELETE') {
        const id = decodeURIComponent(url.split('/').pop());
        const users = getUsers();
        const target = users.find((u) => u.id === id);
        if (!target) return sendJSON(res, 404, { error: '用户不存在' });
        if (target.id === req.user.id) {
          return sendJSON(res, 400, { error: '不能删除自己的账号' });
        }
        if (target.role === 'admin') {
          return sendJSON(res, 400, { error: '不能删除管理员账号' });
        }
        destroyUserSessions(target.username);
        saveUsers(users.filter((u) => u.id !== id));
        return sendJSON(res, 200, { message: '用户已删除' });
      }

      // ================= 视频管理 =================

      // ---- 添加视频（链接方式 / 外链跳转） ----
      if (url === '/api/admin/videos' && method === 'POST') {
        const body = await readBody(req);
        const title = String(body.title || '').trim();
        const description = String(body.description || '').trim();
        const url2 = String(body.url || '').trim();
        // 类型：url = 可播放的视频链接；external = 跳转到外部网页（如正版平台）
        const type = body.type === 'external' ? 'external' : 'url';
        // 分类（动画 / 电影 / 纪录片 / 儿童 / 科普 / 其他）
        const CATEGORIES = ['动画', '电影', '纪录片', '儿童', '科普', '游戏', '其他'];
        const category = CATEGORIES.includes(body.category) ? body.category : '其他';

        if (!title || title.length > 60) return sendJSON(res, 400, { error: '标题不能为空且不超过 60 字' });
        if (!/^https?:\/\//i.test(url2)) return sendJSON(res, 400, { error: '链接需以 http:// 或 https:// 开头' });

        const videos = readJSON(VIDEOS_FILE);
        videos.push({
          id: crypto.randomUUID(),
          title,
          description,
          type,
          url: url2,
          category,
          addedBy: req.user.username,
          createdAt: new Date().toISOString(),
        });
        writeJSON(VIDEOS_FILE, videos);
        return sendJSON(res, 201, { message: '视频添加成功' });
      }

      // ---- 上传视频文件 ----
      if (url === '/api/admin/videos/upload' && method === 'POST') {
        const { fields, filename, fileBuffer } = await parseMultipart(req, MAX_UPLOAD);
        const title = String(fields.title || '').trim();
        const description = String(fields.description || '').trim();
        const CATEGORIES = ['动画', '电影', '纪录片', '儿童', '科普', '游戏', '其他'];
        const category = CATEGORIES.includes(fields.category) ? fields.category : '其他';

        if (!title || title.length > 60) return sendJSON(res, 400, { error: '标题不能为空且不超过 60 字' });
        if (!fileBuffer || !fileBuffer.length) return sendJSON(res, 400, { error: '未收到视频文件' });

        const ext = path.extname(filename || '').toLowerCase();
        if (!VIDEO_EXT.includes(ext)) {
          return sendJSON(res, 400, { error: `不支持的文件格式，仅支持: ${VIDEO_EXT.join(' / ')}` });
        }

        // 随机文件名，防止路径穿越与重名覆盖
        const safeName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
        fs.writeFileSync(path.join(UPLOAD_DIR, safeName), fileBuffer);

        const videos = readJSON(VIDEOS_FILE);
        videos.push({
          id: crypto.randomUUID(),
          title,
          description,
          type: 'file',
          url: `/uploads/videos/${safeName}`,
          category,
          addedBy: req.user.username,
          createdAt: new Date().toISOString(),
        });
        writeJSON(VIDEOS_FILE, videos);
        return sendJSON(res, 201, { message: '视频上传成功' });
      }

      // ---- 删除视频 ----
      if (/^\/api\/admin\/videos\/[^/]+\/?$/.test(url) && method === 'DELETE') {
        const id = decodeURIComponent(url.split('/').pop());
        const videos = readJSON(VIDEOS_FILE);
        const target = videos.find((v) => v.id === id);
        if (!target) return sendJSON(res, 404, { error: '视频不存在' });

        // 若为上传的文件，同时删除磁盘文件
        if (target.type === 'file' && target.url.startsWith('/uploads/')) {
          const filePath = path.join(PUBLIC_DIR, target.url.replace(/^\//, ''));
          if (filePath.startsWith(UPLOAD_DIR)) {
            try { fs.unlinkSync(filePath); } catch { /* 文件可能已不存在 */ }
          }
        }
        writeJSON(VIDEOS_FILE, videos.filter((v) => v.id !== id));
        return sendJSON(res, 200, { message: '视频已删除' });
      }

      return sendJSON(res, 404, { error: '后台接口不存在' });
    }

    // ---- 静态文件 ----
    if (url.startsWith('/api/')) {
      return sendJSON(res, 404, { error: '接口不存在' });
    }
    serveStatic(req, res);
  } catch (e) {
    sendJSON(res, 400, { error: e.message || '服务器内部错误' });
  }
});

// ------------------------- 启动 -------------------------

ensureDataFiles();
ensureAdmin();
ensureVideos();
cleanupSessions();

server.listen(PORT, () => {
  console.log('========================================');
  console.log('  登录网站 + 后台管理 + 视频中心已启动 ✅');
  console.log(`  前台: http://localhost:${PORT}`);
  console.log(`  后台: http://localhost:${PORT}/admin.html`);
  console.log(`  视频: http://localhost:${PORT}/videos.html`);
  console.log('  管理员账号: admin / admin123');
  console.log('  按 Ctrl+C 停止服务器');
  console.log('========================================');
});
