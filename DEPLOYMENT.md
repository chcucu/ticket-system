# 部署说明 · 通用工单系统

本包是可部署版本：后端 API 与前端页面已编译进同一 Node 服务，**一个服务同时提供页面与接口**。

```text
server/
├── dist/                    # 后端编译产物
├── web-dist/                # 前端编译产物（由后端自动托管）
├── package.json             # 依赖清单
├── package-lock.json
├── sql/init.sql             # 建库建表脚本
├── .env.example             # 环境变量示例
└── uploads/                 # 图片上传目录（挂卷可持久化）
Dockerfile                   # 多阶段镜像（一键容器化）
docker-compose.yml            # compose 编排（MySQL + 应用）
README.md
```

---

## 方式一：Docker 一键部署（推荐）

需要 `docker` 与 `docker compose`。在包根目录执行：

```bash
# 可选：创建 .env 覆盖默认配置（数据库密码、SMTP、管理员密码等）
cp .env.example .env

docker compose up -d --build
```

- 首次启动会自动执行 `sql/init.sql` 建表；
- 访问 `http://localhost:3000` 即可看到前端页面并提交工单；
- 图片持久化在 `app_uploads` 卷，数据库在 `db_data` 卷。

按需在 `.env` 中配置（未设则用默认值）：

| 变量 | 含义 |
| --- | --- |
| `DB_PASSWORD` | MySQL root 密码（默认 `root_pass_change_me`） |
| `DB_NAME` | 数据库名（默认 `ticket_system`） |
| `BRAND_NAME/BRAND_TEAM` | 品牌名 / 团队名（邮件、页面标题） |
| `MAIL_HOST/MAIL_PORT/MAIL_SECURE` | SMTP 主机/端口/是否SSL |
| `MAIL_USER/MAIL_PASS/MAIL_FROM` | SMTP 账号/授权码/发件人 |
| `ADMIN_PASSWORD` | 管理员登录密码 |
| `JWT_SECRET` | JWT 签名密钥（生产必改） |

---

## 方式二：直接运行（Node + 自有 MySQL）

```bash
# 1. 安装生产依赖
cd server
npm install --omit=dev

# 2. 配置环境变量
cp .env.example .env   # 修改数据库/邮件/管理员密码

# 3. 初始化数据库
mysql -u root -p < sql/init.sql

# 4. 启动（自动托管前端页面）
node dist/index.js     # 默认端口 3000
```

访问 `http://localhost:3000`。

---

## 接口一览

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/ticket/submit` | 否 | 提交工单（multipart，含图片） |
| GET | `/api/ticket/list?page=&size=` | Bearer Token | 分页列表 |
| POST | `/api/ticket/reply` | Bearer Token | 管理员回复 |
| POST | `/api/auth/login` | 否 | 登录获取 Token |

登录：`POST /api/auth/login` body `{ "password": "<ADMIN_PASSWORD>" }`，返回 `token`，后续请求头加 `Authorization: Bearer <token>`。

---

## 常见问题

- 页面能打开但提交报“网络异常”：请确认使用的是当前包内的 `web-dist`（前后端同源，不走代理）。
- 邮件不发送：`.env` 中 `MAIL_*` 未配置或授权码有误；邮箱为选填字段，留空则不发信，不影响工单。
- 更换管理员密码/端口：修改 `.env` 后重启。
