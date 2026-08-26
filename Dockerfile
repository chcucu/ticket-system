# ============================================================
# 通用工单系统 - 多阶段镜像构建
# 产物为一个自包含的 Node 服务：同时提供后端 API 与前端静态页面
# ============================================================

# ---------- 阶段一：构建前端 ----------
FROM node:20-alpine AS web-builder
WORKDIR /build/web
COPY web/package*.json ./
RUN npm install --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ---------- 阶段二：构建后端 ----------
FROM node:20-alpine AS server-builder
WORKDIR /build/server
COPY server/package*.json ./
RUN npm install --no-audit --no-fund
COPY server/ ./
RUN npm run build

# ---------- 阶段三：精简运行镜像 ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# 复制后端编译产物与生产依赖
COPY --from=server-builder /build/server/package.json ./package.json
COPY --from=server-builder /build/server/node_modules ./node_modules
COPY --from=server-builder /build/server/dist ./dist

# 复制前端构建产物（后端会自动托管 web-dist）
COPY --from=web-builder /build/web/dist ./web-dist

# 上传目录（挂卷可持久化）
RUN mkdir -p ./uploads

EXPOSE 3000
CMD ["node", "dist/index.js"]
