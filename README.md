# 通用工单反馈系统

一个开箱即用、前后端一体、**高度可自定义**的工单反馈系统。前端为移动端优先的极简黑白艺术字风表单，后端为 Express + TypeScript + MySQL。

- 开源协议：MIT
- 技术栈：Node.js · TypeScript · Express · MySQL · Vue 3 · Element Plus
- 特性：图片上传、SMTP 邮件通知、JWT 管理员鉴权、全量 .env 配置、一键 Docker 部署

## 功能特性

- 工单提交：姓名 / 联系方式 / 问题描述 / 选填通知邮箱 / 图片（≤9 张，单张 ≤2MB，JPG/PNG）
- 自动生成唯一工单编号 `TICKET-YYYYMMDD-XXXX`（每天重新计数，事务 + 行锁保证并发安全）
- 提交成功自动发送邮件（附工单编号）；管理员回复后发送回复通知
- 管理员登录鉴权（JWT），分页工单列表与回复接口
- 统一 JSON 错误格式，全程 try-catch
- 单个 Node 服务同时托管后端 API 与前端静态页面
- 多阶段 Dockerfile，`docker compose up -d --build` 一键拉起（自动建库）

## 目录结构

```text
server/                      后端
├── src/
│   ├── index.ts             入口 & 前端静态托管
│   ├── config.ts            环境变量集中校验（品牌/DB/SMTP/JWT/上传）
│   ├── db.ts                数据库连接池
│   ├── middlewares/         JWT 鉴权 / 图片上传(multer)
│   ├── routes/              /auth /ticket 路由
│   └── utils/               ticket_id 生成 / nodemailer / jwt / 响应封装
├── sql/init.sql             建库建表
└── .env.example             环境变量示例
web/                         前端
├── src/
│   ├── app.config.ts        ★ 站点自定义入口（品牌/文案/上传限制/主题色）
│   └── views/TicketForm.vue 单文件页面（表单 + 成功页）
└── vite.config.ts           开发代理
Dockerfile  docker-compose.yml
```

## 快速开始（Docker）

```bash
cp server/.env.example .env        # 按需修改（推荐改动 DB_PASSWORD / ADMIN_PASSWORD / JWT_SECRET）
docker compose up -d --build
# 访问 http://localhost:3000
```

## 本地开发

```bash
# 后端（端口 3000）
cd server && cp .env.example .env && npm install
mysql -u root -p < sql/init.sql
npm run dev

# 前端（端口 5173，代理到 3000）
cd web && npm install && npm run dev
```

## 高度可自定义

只需改两个文件即可完成换皮与换肤，无需改动任何业务代码。

### 前端 `web/src/app.config.ts`

| 配置项 | 说明 |
| --- | --- |
| `site.name` | 站点/品牌名（大标题、浏览器标题、邮件可共用后端品牌） |
| `site.eyebrow / tagline / sla` | 英文眉标、副标题、服务承诺文案 |
| `copy.*` | 全部表单标签、占位提示、按钮与成功页文案 |
| `upload.maxCount / maxSizeMb` | 图片数量与单张大小限制 |
| `api.base` | 后端接口前缀 |
| `theme.accent` | 强调色，改一个十六进制值即整体换肤（默认近黑） |

### 后端 `server/.env`

`BRAND_NAME / BRAND_TEAM`（邮件与页面标题）、`DB_*`（数据库）、`MAIL_*`（SMTP）、`ADMIN_PASSWORD / JWT_SECRET`（鉴权）、`MAX_IMAGE_*`（上传限制）。

## 接口

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/ticket/submit` | 否 | 提交工单（multipart/form-data） |
| GET | `/api/ticket/list?page=&size=` | Bearer Token | 分页列表，时间降序 |
| POST | `/api/ticket/reply` | Bearer Token | 管理员回复 |
| POST | `/api/auth/login` | 否 | 登录获取 JWT |

## 角色与协作

感谢所有为这个项目做出贡献的人！欢迎提交 Issue、发起 PR 或提出新特性建议。开发前请保持代码风格一致，为关键逻辑补充注释，并保证 `server:npm run typecheck` 与 `web:npm run build` 通过。

## License

[MIT](./LICENSE)
