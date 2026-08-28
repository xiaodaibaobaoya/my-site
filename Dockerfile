# 登录网站 + 后台管理 + 视频中心 —— 云端部署镜像
# 零依赖项目，无需 npm install，直接运行
FROM node:20-alpine

WORKDIR /app

# 复制项目代码
COPY . .

# 确保数据目录存在
RUN mkdir -p /app/data /app/public/uploads/videos

# 监听 Railway 提供的 PORT（默认 3000）
EXPOSE 3000
ENV PORT=3000

# 启动
CMD ["node", "server.js"]
