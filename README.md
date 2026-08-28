# 🔐 登录网站 + 后台管理系统 + 视频中心

一个零依赖的完整网站：Node.js 后端 + 原生前端，数据保存在本地 JSON 文件。
包含用户登录前台、功能齐全的后台管理系统，以及视频观看中心。

## 功能

**前台（登录网站）**
- ✅ 用户注册（用户名查重、格式校验）
- ✅ 用户登录（密码 scrypt 加盐哈希，绝不保存明文）
- ✅ 记住我（7 天免登录）/ 不记住（2 小时会话）
- ✅ 登录后跳转（管理员进后台，普通用户进欢迎页）
- ✅ HttpOnly Cookie 会话，防止 XSS 窃取凭证
- ✅ 可爱风 UI：液态玻璃按钮、飘落动画、流光文字

**🎬 视频中心**
- ✅ 视频列表页（缩略图自动取视频第一帧）+ 播放页（HTML5 播放器）
- ✅ 预置 50 部视频，7 大分类（动画 20 / 纪录片 11 / 儿童 5 / 电影 4 / 科普 3 / 游戏 3 / 其他 4）：大雄兔·辛特尔等本地动画 + 熊出没/喜羊羊/猫和老鼠/小猪佩奇/斗罗大陆/秦时明月/柯南/哆啦A梦/海绵宝宝/宫崎骏等 B 站正版外链
- ✅ **分类筛选栏**：一键按分类浏览，卡片带分类角标
- ✅ 登录用户即可观看，无需管理员权限
- ✅ 三种视频来源：网络视频链接 / 上传本地文件（mp4/webm/ogg，≤100MB）/ 外链跳转（点击卡片直达正版平台页面）



## ☁️ 部署到云端（Railway 免费版）—— 手机不再当服务器

项目已内置 `Dockerfile` 与 `railway.json`，一键部署。

**第一步：上传代码到 GitHub**
1. 注册/登录 [github.com](https://github.com)，点 **New repository**，仓库名随意（如 `my-site`），选 **Public**，创建
2. 进入仓库页面 → 点 **Add file → Upload files**
3. 把 `login-site` 文件夹里的**以下内容**拖进去上传：
   - `server.js`、`Dockerfile`、`railway.json`、`.dockerignore`
   - `public/` 整个文件夹（前端页面）
   - `data/` 整个文件夹（可选，含初始视频列表；没有也行）
4. 点 **Commit changes** 提交

**第二步：Railway 部署**
1. 注册/登录 [railway.com](https://railway.com)（用 GitHub 账号一键登录最方便）
2. 点 **New Project → Deploy from GitHub repo** → 授权并选择刚才的仓库
3. Railway 自动识别 Dockerfile 并开始构建，等待 2-5 分钟
4. 构建完成后点项目里的 **Settings → Networking → Generate Domain**，生成公网地址（形如 `https://xxx.up.railway.app`）

**第三步：配置数据持久化（重要！防重启丢数据）**
1. 项目里点 **Service → Settings → Volumes → Add Volume**
2. Mount Path 填 `/app/data`
3. （可选）再挂一个，Mount Path 填 `/app/public/uploads`，保存上传的视频文件

**第四步：使用**
- 浏览器访问生成的地址（如 `https://xxx.up.railway.app`），管理员 `admin / admin123`
- App（v1.8）首次打开会要求填服务器地址 → 粘贴你的 Railway 地址 → 手机就不再当服务器啦 🎉

> ⚠️ Railway 免费额度约 $5/月，本项目资源占用极小，足够长期使用；服务空闲可能休眠（重新访问会冷启动等待几十秒）。
