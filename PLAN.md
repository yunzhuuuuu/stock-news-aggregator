# Mini Robinhood：美股持仓与新闻聚合网站实施计划

项目性质：个人、非商业的学习与作品展示项目，不提供交易服务，也不收费。

更新：2026-09-17。当前仓库只有 main.py；本计划尚未开始实现网站。

## 1. 第一版目标与边界

- 网站有公开网址，任何人可以注册自己的本站账户；每个人只能看到自己的持仓。
- 用户手动输入美股代码、当前股数和平均买入价；不连接券商，也不索取券商凭证。
- 展示最新可用的日收盘价、价格日期、持仓市值、未实现盈亏、相关新闻和规则信号。
- 股价在每个交易日收盘后更新一次；新闻在有人使用页面时至多每 5 分钟检查一次。页面必须分别显示新闻发布时间、抓取时间和股价交易日期。
- 第一版不记录逐笔交易，不计算已实现盈亏、税务成本或分红回报，不提供下单功能。以后需要这些功能时增加交易流水表。
- BUY/HOLD/SELL 是公开写明公式的规则信号，不冒充分析师建议。

验收样例：两个用户分别登录后，看不到对方持仓；输入 2.5 股、平均成本 100 美元、收盘价 110 美元，页面显示未实现盈亏 25 美元；新闻不可用时仍能看到持仓及上次成功抓取的数据。

## 2. 技术结构

- 前端和网站服务端：Next.js App Router、TypeScript、React、Tailwind CSS。Server Components 读数据库；交互表单和标签页用 Client Components；需要浏览器访问的新闻刷新接口用 Route Handler。
- 身份验证和数据库：Supabase Auth + Postgres。Auth 管登录；Postgres 存持仓、公共价格缓存、公共新闻缓存；Row Level Security（RLS）隔离每个用户的持仓。
- 部署：代码放 GitHub，web/ 目录作为 Vercel 项目的根目录。Vercel 提供公开 HTTPS 地址；Supabase 和 API 密钥放部署环境变量。
- 数据供应商：通过 lib/providers/ 中的适配器调用，UI 和数据库不依赖某一家供应商的响应格式。发布前确定供应商的额度、价格延迟、历史价格能力，以及公开展示和缓存许可。

数据流：
用户浏览器 → Next.js 服务端 → Supabase（用户持仓 + 公共缓存）
Next.js 服务端 → 数据供应商 API → 校验、去重、写公共缓存 → 页面

## 3. 项目布局

在现有仓库内创建 web/，保留 main.py。建议的核心位置：

- web/src/app/：dashboard、登录页和必要的 API Route Handlers
- web/src/components/：持仓卡片、添加/编辑表单、新闻列表、信号说明
- web/src/lib/supabase/：浏览器和服务端 Supabase 客户端
- web/src/lib/providers/：新闻、日收盘价、历史日线的供应商适配器
- web/src/lib/finance/：盈亏与信号的纯函数
- web/supabase/migrations/：版本化 SQL 表结构、权限策略和索引
- web/.env.example：只列环境变量名，不包含真实密钥

先在 WSL 中确认 Node.js、npm 和 Git 可用，然后在仓库根目录创建 Next.js 项目：npx create-next-app@latest web --ts --eslint --app --src-dir --tailwind。开发时从 web/ 运行 npm run dev。

## 4. 数据库设计

1. positions
   - id UUID 主键；user_id UUID 关联 auth.users；symbol 大写美股代码
   - quantity NUMERIC(18,6)，必须大于 0；average_cost NUMERIC(18,4)，必须大于或等于 0
   - created_at、updated_at；UNIQUE(user_id, symbol)
   - 用户在页面修改股数或平均成本，表示修改当前持仓快照。

2. daily_prices
   - symbol、trading_date 组成唯一键；close NUMERIC(18,4)；currency、provider、fetched_at
   - 对所有用户共享，不重复为每个用户保存同一只股票的价格。
   - 至少保存最近 20 个有效交易日，供规则信号计算。

3. articles
   - id、provider、provider_article_id 或规范化 URL 唯一键
   - title、source、url、published_at、fetched_at、summary（仅在供应商允许时缓存）
   - article_symbols 关联文章与股票代码，避免一篇文章在多个股票下重复存储。

4. refresh_state
   - 按 symbol + data_type 保存 last_success_at、next_eligible_at、refresh_lease_until、last_error。
   - 用短暂租约确保多位用户同时打开页面时只有一次外部 API 请求。

positions 启用 RLS，只允许已登录用户对 user_id = auth.uid() 的行读写；匿名用户没有持仓权限。公开缓存表仅由服务端任务写入。每次迁移都要验证数据库权限；服务端写入用的高权限密钥绝不交给浏览器。

## 5. 价格、盈亏与信号

- 价格采用最近一个完整美股交易日的收盘价；周末和市场假日仍显示该交易日日期，不把旧收盘价称作实时价。
- 每个交易日美东收盘后触发一次价格更新；免费托管可用每天一次的定时任务，任务运行时先检查纽约市场日期与供应商是否已提供新收盘价。任务失败时保留旧数据并标注日期。
- 对每只股票：持仓市值 = quantity × close；成本 = quantity × average_cost；未实现盈亏 = 持仓市值 − 成本；盈亏率 = close / average_cost − 1（average_cost 为 0 时不显示百分比）。用精确十进制计算，最后才把美元显示值四舍五入到小数点后 2 位。
- 信号基于日收盘价：计算最近 5 个和 20 个交易日的简单移动平均线。若 SMA5 / SMA20 − 1 大于 0.02，显示 BUY；小于 −0.02，显示 SELL；否则 HOLD。少于 20 个交易日或价格缺失时显示“数据不足”，不猜测信号。
- 在信号旁显示规则、计算所用的最后交易日。它是演示用的技术指标，不引用用户的买入成本，也不宣称预测准确率。

## 6. 新闻抓取与质量控制

- **开发阶段采用 Marketaux**：免费层目前每天 100 次请求、每次最多 3 篇，支持按股票代码、语言和发布时间筛选；比继续占用 Alpha Vantage 每天 25 次的价格与新闻共享额度更适合 Stage D。本项目属于个人、非商业用途；若生产地址保持公开自由注册，再核对公开多用户展示和缓存范围。
- 用户打开或停留在某只股票的新闻页时，页面每 5 分钟请求本站接口；本站先读公共缓存。缓存不足 5 分钟则直接返回。
- 缓存过期时，服务器先取得刷新租约，再调用供应商一次；其他请求暂时返回旧缓存和“正在更新”状态。供应商超时、429 或返回空结果时，保留上次成功的数据，显示错误和抓取时间。
- 按文章 URL 或供应商 ID 去重；核对股票代码、发布时间、来源与链接；按发布时间排序；只显示标题、来源、时间、允许展示的摘要与原文链接，不复制整篇新闻。
- 设置每日 API 调用上限和日志，限制单用户最多关注的股票数。达到预算上限时返回缓存，并明确标注“新闻可能延迟”。
- 供应商选择是上线前的门槛：用 AAPL、TSLA、GOOGL、一个小盘股连续抽样，检查新闻覆盖、重复率、延迟、坏链接、速率限制、公开展示条款和实际费用。候选可比较 Finnhub 公司新闻与 Marketaux；Alpha Vantage 免费额度仅适合小规模开发测试，不承诺支撑多用户五分钟刷新。

### Stage D 拟实施步骤

1. **D1：数据结构与供应商适配器**
   - 建立 `articles`、`article_symbols`、`news_refresh_state` 和每日调用计数表；登录用户只读，服务端任务写入。
   - 建立 Marketaux 适配器，校验文章 ID、标题、来源、HTTPS 链接、发布时间、摘要和关联股票代码；API token 只使用服务端环境变量 `MARKETAUX_API_TOKEN`。
   - 对供应商响应、空结果、坏链接、重复文章、429 和格式错误写纯函数测试。
2. **D2：五分钟缓存、租约与额度保护**
   - 新增受登录保护的 `/api/news?symbol=...`；只允许用户请求自己持仓中的代码，避免用本站额度查询任意股票。
   - 先返回共享缓存；缓存超过五分钟时用数据库原子操作取得短租约，确保并发用户只触发一个外部请求。
   - 每日硬上限先设为 90 次，为人工检查和供应商误差保留 10 次；达到上限或供应商失败时返回旧缓存和清楚的延迟状态。
3. **D3：Dashboard 新闻体验与真实验收**
   - 仅在用户选择 News 标签时请求；标签保持打开且页面可见时，每五分钟重新检查，离开标签后停止。
   - 展示标题、来源、发布时间、抓取时间、允许缓存的短摘要和原文链接；明确区分“没有相关新闻”“正在更新”“旧缓存”“供应商失败”。
   - 用 AAPL、NVDA、一个低新闻量有效代码和一个无效代码验证覆盖、去重、坏链接、缓存命中、并发租约与故障回退。

Stage D 开始写代码前先由用户批准本方案。迁移完成后再要求用户申请并自行配置 Marketaux token；密钥不通过聊天传递。

进度：Stage D 已于 2026-09-20 完成。D1 数据结构和适配器、D2 租约/缓存/额度保护及 D3 Dashboard 新闻体验均已实现；AAPL 真实新闻和五分钟缓存、无效代码、双账户、标签切换与手机布局通过验收。News 标签保持打开且页面可见时每五分钟重新检查，离开标签后停止。

## 7. 页面和交互

- 登录/注册页：邮箱、密码、验证邮件、退出登录。
- Dashboard：总市值和总未实现盈亏；持仓卡片展示代码、股数、平均成本、日收盘价、价格日期、盈亏与规则信号。
- 左侧持仓管理：输入股票代码、股数、平均成本；支持修改、删除；校验格式、正数和重复代码。
- 右侧详情：Overview 显示价格与信号公式，News 显示新闻列表和更新时间。不要做没有可靠数据来源的财务指标、分析师人数或假价格。
- 加载中、无持仓、新闻为空、数据过期、API 出错和手机窄屏都要有明确状态。

## 8. 实施顺序与完成标准

阶段 A：初始化 web/、基础页面、响应式布局和假数据。完成标准：桌面与手机可操作，所有示例值标为演示数据。

阶段 B：接入 Supabase Auth、positions 表、RLS、添加/修改/删除持仓。完成标准：用户 A、用户 B 和未登录访问的隔离测试通过。

阶段 C：实现 daily_prices、收盘价每日任务、盈亏和 SMA 信号。完成标准：小数股数、零成本、假日、缺价、少于 20 天数据均有正确结果与标签。

阶段 D：实现新闻供应商适配器、5 分钟缓存、租约、去重、额度保护。完成标准：并发刷新不会重复调用供应商；API 故障时仍能显示旧新闻；实测新闻覆盖符合预期。

阶段 E：部署到 Vercel，配置 Supabase 回调 URL 和环境变量，启用生产数据库迁移，测试公开网址。完成标准：注册、邮箱验证、登录、持仓保存、新闻、收盘价、手机页面和两用户隔离在生产地址都通过。

### Stage E 拟实施步骤

1. **E1：上线前本地准备**
   - 当前文件夹还不是 Git 仓库；建立版本库前先复查 `.gitignore`，确保 `.env.local`、构建目录和备份不会进入提交。
   - 加入 Vercel 每日价格 Cron 配置。Hobby 计划只允许每天一次，并可能在指定小时内任意时间触发，因此安排在美股收盘后的安全时段；接口继续验证 Vercel 自动发送的 `Authorization: Bearer <CRON_SECRET>`。
   - 列出生产环境变量名称，但所有真实值仍由用户直接填入 Vercel，不写入仓库或聊天。
2. **E2：Preview 部署**
   - 建立远程代码仓库并从 `web/` 作为 Vercel Root Directory 部署 Preview。
   - 配置 Preview 环境变量，验证构建、登录页、受保护接口和运行日志；环境变量修改后重新部署才生效。
3. **E3：生产认证与供应商门槛**
   - 将 Supabase Site URL 设为最终生产地址，并添加精确的生产 Redirect URL；保留 `http://localhost:3000/**` 用于本地开发。Preview 通配地址只用于 Preview。
   - 本项目已确认为个人、非商业用途。若生产地址继续允许任何人注册并查看供应商数据，仍需确认公开多用户展示与缓存属于允许范围，或将网站限制为个人演示访问、改用许可明确的供应商。
4. **E4：生产发布与最终验收**
   - 发布 Production，核对 Cron、日志和 API 计数；用两个真实账户复测注册确认、登录、持仓隔离、价格、新闻、退出重登和手机页面。
   - 完成安全检查、依赖审计和最终生产构建，并记录最终验收结果。

Stage E 开始改动仓库或部署前先由用户批准。E1/E2 可以先进行；项目按个人、非商业用途部署。若最终保留“任何人可注册”的公开模式，再单独确认第三方数据公开转发与缓存范围。

进度：E1 已于 2026-09-20 完成。本地 Git `main` 分支、密钥忽略检查、Vercel 每日价格 Cron、生产环境变量清单和完整自动检查均已完成；尚未连接远程仓库或部署 Preview。

测试集中在财务计算、权限、供应商故障、缓存并发与主要用户流程；不为纯样式改动写重复实现的测试。

## 9. 费用、安全与上线门槛

- Vercel Hobby 适用于非商业个人作品；其 Cron 最快每天一次，符合每天更新股价。新闻 5 分钟检查采用访问驱动缓存，不依赖高频 Cron。
- Supabase 免费层可用于原型，但要监测数据库大小、调用量和低活跃项目暂停机制。
- API 费用由“独特股票数 × 新闻刷新次数”主导，不是用户数本身；多个用户关注同一股票应共用缓存。供应商限制不够时提高缓存时间、减少关注上限或升级计划，不能悄悄突破额度。
- 密钥只在服务端；表单校验、RLS、登录频率限制和错误日志在上线前完成；绝不在日志中打印密钥或用户密码。
- 上线前确认数据供应商允许公开网站显示价格、新闻元数据及所采用的缓存方式。未经确认，仅使用假数据或私人测试环境。

## 10. 参考资料（新闻供应商信息更新：2026-09-20）

- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Vercel Cron 用量和计划限制: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Alpha Vantage 免费请求额度: https://www.alphavantage.co/support/
- Marketaux 定价与免费层: https://www.marketaux.com/pricing
- Marketaux API 文档: https://www.marketaux.com/documentation
- Marketaux 服务条款: https://www.marketaux.com/tos
- Finnhub 官方 SDK 的接口定义: https://github.com/Finnhub-Stock-API/finnhub-go/blob/master/api/openapi.yaml
