# Mini Robinhood 网站

`web/` 是项目中实际运行的 Next.js 应用。所有 npm 命令都应从这个目录执行。

## 你现在需要做什么

Stage A 至 D 已完成。真实价格、持仓计算、用户隔离和 Dashboard 新闻均已通过本地验收。

Stage E1 本地部署准备、E2 公开仓库和首次 Vercel Production 部署已完成。网站现已上线：<https://stock-news-aggregator-lake.vercel.app>。下一步是配置 Supabase 生产回调并完成登录验收。

GitHub 仓库：<https://github.com/yunzhuuuuu/stock-news-aggregator>。Vercel 应把 Root Directory 设为 `web`。

本项目是个人、非商业的学习与作品展示项目。E1 本地准备和 Preview 构建可以继续；如果最终保持“任何人可注册”的公开模式，再确认供应商对公开多用户展示与缓存的允许范围，或限制为个人演示访问。

不要手动修改 `news_api_usage` 或租约字段，也不要把 Marketaux token 发到聊天中。

不要把任何 API 或 Supabase 密钥发到聊天中。

## Vercel 环境变量清单

在 Vercel Dashboard 中逐项填写真实值，不要提交 `.env.local`：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALPHA_VANTAGE_API_KEY`
- `MARKETAUX_API_TOKEN`
- `CRON_SECRET`

`CRON_SECRET` 应使用新的长随机值。Vercel 调用 Cron 时会自动把它作为 Bearer token 发送；不需要把本地使用的 `PRICE_REFRESH_SECRET` 配到 Vercel，除非还需要手动调用价格刷新接口。

`vercel.json` 每天在 23:00 UTC 请求一次 `/api/prices/refresh`。这个时间全年都晚于美股常规收盘；Vercel Hobby 可能在该小时内的任意时间执行。

## 当前阶段

- 阶段 A 已完成：响应式 Dashboard 和基础交互。
- 阶段 B 已完成：注册、登录、退出、持仓持久化和双用户数据隔离均通过实际检查。
- 阶段 C 已完成：真实价格、精确计算、SMA、无效代码、共享缓存和新增持仓即时刷新均通过验收。每日部署触发器留到阶段 E 配置。
- 阶段 D 已完成：AAPL 真实新闻、五分钟缓存、BBPL 无效代码、标签切换、双账户和手机布局均通过验收。
- 阶段 E 进行中：生产环境变量和首次部署已完成；公开页面及未授权 API 已通过线上检查，尚待 Supabase 生产回调、登录流程和 Cron 实际运行验收。

## 启动网站

在 WSL 中运行：

```bash
cd /home/yunzhu/github/mini-robinhood/web
npm run dev
```

然后打开 <http://localhost:3000>。

如果 Next.js 已经在运行，不要重复启动第二个开发服务器；直接刷新浏览器即可。

## Supabase 本地配置

Next.js 从 `web/.env.local` 读取 Supabase 的两个公开连接变量：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

本项目已经完成本地连接。如果以后需要重新配置，可从 `web/` 复制模板：

```bash
cp .env.example .env.local
```

然后从 Supabase 的项目设置中填入 Project URL 和 publishable key，并重新启动开发服务器。

`SUPABASE_SERVICE_ROLE_KEY` 也保存在 `.env.local`，但它只允许被服务端刷新接口使用。不要给它加 `NEXT_PUBLIC_` 前缀。浏览器只使用 publishable key，私有持仓由数据库 Row Level Security（RLS）保护。

## 已执行的数据库迁移

### positions

文件：

```text
supabase/migrations/202609190001_create_positions.sql
```

该迁移已经在 hosted Supabase 中执行。它创建用户持仓表以及 SELECT、INSERT、UPDATE、DELETE 四条 RLS 策略，每条策略都要求 `auth.uid() = user_id`。

### daily_prices

文件：

```text
supabase/migrations/202609190002_create_daily_prices.sql
```

该迁移已经在 hosted Supabase 中执行并通过 Dashboard 空缓存检查。它创建所有用户共享的日收盘价缓存。已登录用户可以读取缓存，但使用浏览器 publishable key 的客户端不能写入或修改价格；只有受保护的服务端价格任务负责写入。

### price_refresh_status

文件：

```text
supabase/migrations/202609200001_create_price_refresh_status.sql
```

该迁移已经在 hosted Supabase 中执行。它记录每个共享股票代码最近一次刷新为成功、无效代码或临时错误。登录用户只能读取，服务端刷新任务负责写入。该表不保存邮箱、股数或平均成本。

### Stage D 新闻缓存

文件：

```text
supabase/migrations/202609200002_create_news_cache.sql
```

该迁移已经在 hosted Supabase 中执行。它创建文章、文章与股票代码关联、新闻刷新状态和每日 API 用量四张表。登录用户只能读取共享文章和刷新状态；只有服务端可以写入新闻或修改额度计数。四张表的服务端读取和未登录拒绝路径均已验证。

## 价格刷新如何工作

- `POST /api/prices/refresh` 和 `GET /api/prices/refresh` 都要求请求头 `Authorization: Bearer <PRICE_REFRESH_SECRET>`；未授权请求返回 401。
- 服务端使用 `SUPABASE_SERVICE_ROLE_KEY` 读取全部持仓代码并去重，浏览器永远不会取得这个 key。
- Alpha Vantage `TIME_SERIES_DAILY` 的 compact 结果提供最近约 100 个交易日，写入时按 `symbol + trading_date` 更新共享缓存。
- 股票逐个刷新；某只股票请求失败时继续处理其他股票，并保留该股票之前成功缓存的数据。
- 新增或编辑持仓后立即检查该代码；12 小时内已有共享结果时直接复用，否则只刷新这一只股票。外部接口临时失败不会撤销已经保存的持仓。
- GET 方法供每日 Vercel Cron 使用；定时配置已经部署，未授权请求在线上返回 401，尚待首次定时运行后确认实际刷新结果。

## 注册和邮件确认设置

在 Supabase 中打开 **Authentication → URL Configuration**：

- 本地 Site URL：`http://localhost:3000`
- Redirect URLs：包含 `http://localhost:3000/**`

注册确认路由同时支持 Supabase 的 PKCE `code` 和服务端 `token_hash` 格式。若项目允许修改确认邮件模板，可使用：

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

当前页面流程：

1. `/` 只显示登录表单。
2. 点击 **Create account** 前往 `/signup`。
3. 注册页要求邮箱、密码和再次确认密码。
4. 注册成功后显示 **Check your email**。
5. 点击确认邮件链接后返回 Mini Robinhood。

## Supabase 测试邮件限制

Supabase 内置测试邮件服务目前按项目限制为每小时最多两封认证邮件。达到限制时会出现 `email rate limit exceeded`；等待额度恢复后可继续测试。

内置服务只适合开发测试。正式开放注册前，需要配置自定义 SMTP，并重新检查供应商的发送额度、允许的收件人范围和邮件送达情况。

## 已完成的阶段 B 验证

- 两个真实邮箱都完成注册和登录。
- 用户 A 和用户 B 互相看不到对方持仓。
- 退出后重新登录，两个用户都能看到自己之前保存的内容。
- 添加、修改、删除和刷新后的持久化流程可用。
- 未登录用户只能看到认证界面，不能进入持仓 Dashboard。

## 阶段 C 计算规则

- 持仓市值：股数 × 最新日收盘价。
- 成本：股数 × 平均成本。
- 未实现盈亏：持仓市值 − 成本。
- 平均成本为零时，不显示没有意义的盈亏百分比。
- SMA5 高于 SMA20 超过 2% 时显示 BUY。
- SMA5 低于 SMA20 超过 2% 时显示 SELL。
- 其他情况显示 HOLD。
- 少于 20 个有效交易日时显示 `insufficient data`，不猜测信号。
- 规则信号仅供项目演示，不是投资建议。

所有金额计算先使用精确十进制，最后才转换成页面显示值。

## 项目检查

从 `web/` 运行：

```bash
npm test
npm run lint
npm run build
npm audit
```

最近一次结果：37 个价格计算、供应商、新闻缓存、响应校验、并发状态和失败回退测试全部通过，lint 和生产构建通过；未授权价格刷新接口和新闻接口分别实测返回 401。上一次依赖审计为 0 个已知漏洞。

### Stage D2 新闻刷新函数

文件：

```text
supabase/migrations/202609200003_create_news_refresh_functions.sql
```

该迁移已在 hosted Supabase 中执行。`claim_news_refresh` 会原子检查五分钟缓存、30 秒租约和每日 90 次内部预算，只有取得租约的请求才增加用量；`complete_news_refresh` 会释放租约并记录成功或一分钟失败重试时间。两个函数只授权给 Supabase `service_role`。

首次真实验收发现原函数的返回字段 `request_count` 与表字段同名，PostgreSQL 因歧义在调用外部供应商前停止。修复迁移为：

```text
supabase/migrations/202609200004_fix_news_refresh_claim.sql
```

它将公开返回字段改为 `usage_count` 并限定所有表字段引用。该修复迁移已在 hosted Supabase 中执行并通过真实验收。

当前项目检查结果：33 个测试全部通过，lint 和生产构建通过；未登录 `/api/news?symbol=AAPL` 实测返回 401。
