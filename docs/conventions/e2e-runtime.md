# E2E 运行时约定（M95.F04.I01）

> 什么时候读我：本仓跑 `npm run e2e` 前，或 CI 接 Playwright（T-5）时。
> 决策依据：suite ADR-0030（e2e 仓不自起被测服务；tag/nightly 触发）；
> lab 家族落地 ADR-0033 阶段三。

## 1. 谁起服务：外部起，本仓不自起

本仓 **没有** globalSetup/webServer 自动起服。四个被测进程由运行环境（本机终端或
CI 脚本）事先起好；没起 → Playwright 报 connection refused，**这是环境错误，
不是用例失败**，修环境而不是改用例。

理由：ADR-0030 Decision 7（tag/nightly 触发，CI 脚本负责起服）；本仓保持
mock-friendly 语义（不起服时门禁照常可跑，E2E 用例仅在显式执行时需要服务）。

## 2. 起服清单（顺序即依赖序）

| 序 | 仓 | 端口 | 命令（仓根） | 前置 |
|---|---|---|---|---|
| 1 | lab-management-system-nextjs | 5201 | `npm run dev` | PG 库在位（migrate + seed，见 §3.5） |
| 2 | lab-management-system-react | 5202 | `npm run dev` | nextjs 在跑 |
| 3 | lab-management-system-vue | 5203 | `npm run dev` | nextjs 在跑 |

健康检查：nextjs `GET :5201/api/health` 返回 200。API base = `http://localhost:5201/api`（e2e env `E2E_API_BASE_URL`）。

2026-09-17 msw 仓已删（剔除设计 Phase 4 提前）：API 后端从 msw :5200 切到真
lab-nextjs :5201（同款 `/api/auth/login` 形状）。lab-nextjs 是 DB 参照实现，
起服前必须 migrate + seed（shared 权威种子）。

## 3. 前端 API base：用环境变量覆盖指向 lab-nextjs

三前端仓 `.env.local` 的默认后端各不相同，跑 E2E 时用进程 env 覆盖（优先级高于
.env.local）：

- react / vue：`VITE_API_BASE_URL=http://localhost:5201`
- nextjs：`NEXT_PUBLIC_API_BASE_URL=`（空 = 同源，走本仓 /api routes）

CI 已内置这三个覆盖（ci.yml envs）。本机手动起服时同样带上，否则用例打到
默认后端。CORS：lab-nextjs 白名单含 5201/5202/5203（multi-repo-family §6）。

## 3.5 数据生命周期（ADR-0033 阶段三；2026-09-17 切真后端后语义更新）

真后端 DB 持久化——跨运行累积会撑爆分页首屏（flaky 实伤过 saas AC-4）。
本仓 `globalSetup` 在每轮跑测前跑 shared `scripts/seed-db.mjs` **upsert 重灌**
（`E2E_DATABASE_URL` 指向被测 lab-nextjs 实际连的库），把写路径用例翻转过的
种子行还原；自产行靠唯一 code（`uniqueCode`），不依赖删除式清理。
`globalTeardown` 同款再灌一次，防失败泄漏残留污染开发者手动浏览。
CI 用一次性 `lab_e2e` scratch 库（见 ci.yml postgres service），
本机默认打 lab_dev——介意污染可给 lab-nextjs 换 scratch 库再跑。

### 3.6 REF 形状缝（2026-09-13 首轮联跑登记）

shared 契约部分列表端点回**裸数组**（`TechnicalRequirement[]` 等），三端 REF 页面一律读
`{items,total}` 且按 `id` 寻址行（字典行无 `id`、委托书锚语义/技术要求 UI 结构分歧见
function-tree M95 前言）。处理原则：**后端保持契约形状不动，桥接放测试缝**——
`tests/helpers.ts installRefShapeAdapters` 用 `page.route` 包形状 + 补行 id
（镜像 react 仓 `tests/helpers/seed.ts installShapeAdapters` 家族先例）。
配套：后端列表 newest-first（家族约定，同 audit occurred_at DESC），
否则 flow-matrix 派生的 210 条委托书 seed 把新建行挤出 page1-only 的列表视图。
三端共享一个有状态真后端 → 断言必须保持**唯一 code/brand 基**（页面作用域 + hasText
唯一值）；新增用例禁止跨端计数断言（`toHaveCount(before ± n)` 会被其他 project 的
写入污染）。并行性：config 实际取 `workers: 1`（串行求确定性，wall ~4min 仍远低于
900s 门限）——2026-09-13 probe13/14 曾把串行也救不了的假红归因并行负载，真根因是
两个已根治问题（见下）：nextjs dev 惰性编译冷路由拖挂首用例 + helpers 对异步渲染
树的 `count()` 快照竞态。若未来要回并行，先保住这两条不变量。

**nextjs dev 暖机（globalSetup 内建）**：dev 模式路由惰性编译，冷路由首个请求挂数十秒，
页面停在「菜单加载中…/暂无数据」空态、断言假红（probe14 实证，串行 worker 也一样——
不是负载问题是编译慢；smoke-nav 按字典序跑在后面，暖不了前面的用例）。
`src/global-setup.ts` 在种子重灌后对 E2E_NEXTJS_URL 全量页面 + 高频 API 各发一次
请求预热（任意状态码=编译完成；allSettled + warn 不阻塞，服务没起由用例显式红）。
新增 nextjs 页面/路由 handler 后若用例仍偶发空态假红，先怀疑冷编译——把路由加进
暖机清单。

**异步渲染树禁裸 count()**：nextjs 二级树/类别按钮首帧 count=0 是常态（数据未回），
helpers 的 `selectCategoryWithRows` / spec 的 `revealRows` 都先 `waitFor visible`
再计数；新写选择器计数逻辑照此办理，763ms 级秒挂 + 「没有任何…seed 行」就是这个坑的指纹。
会话预置坑（probe3 三端齐红实证）：`loginAndSeed` 的 `addInitScript` 会在**同一 page
的每次导航**重新种回 storage——登出后若在本 page `goto` 受保护页，init 脚本会先把
token 种回去，路由守卫永远不触发。验证「登出后访问受保护页被弹回」必须开同 context
**新 page**（共享已清空的 localStorage、无 init 脚本），见 session.spec AC-2。
登出验证第二、三个坑（probe5/6/8/11/12 迭代实证，三个机制叠加、缺一即红）：
**其一**，登出跳 /login 时主 page 自己的 init 脚本会再次执行，把刚清掉的 token
重新种回 context 共享 storage——修法是把 seed 通道改「本 page 只播一次」：
`seedSession` 的 init 脚本用 sessionStorage 旗标作闸（按 page 存活、跨导航保留、
跨 page 隔离），见 `tests/helpers.ts seedSession`。
**其二**，/login 挂载即自动走 SSO roundtrip——msw 时期 IdP 跳板被全程虚拟化
（authorize 直接回 code、callback 签真 JWT），**主 page 自己**登出后就会静默
重登、把新 token 写回共享 storage（probe11 实证）；**其三**，fresh page 的
/login 同理也会自动重登。真实 IdP 下登出后不可能静默重登，所以 AC-2 在主 page
和 fresh page 上都 `route` abort `/api/auth/sso/authorize`（模拟「无用户交互
不发 code」，M95.F02.I01 已登记的 route 虚拟化先例）。

## 4. 本仓 env

见 `.env.example`（fail-fast，禁兜底）。真值进 `.env.local`（gitignored）；
登录凭据 = 家族 DEMO 用户 + DEMO_PASSWORD（lab-nextjs ConfigUserDirectory 校验），**不进断言/注释**。

## 5. live 模式（2026-09-22 波2 接入：live 冒烟批）

live = react 单实例（:5206）指向真后端 lab-aspnetcore :5204 / lab-springboot :5205 的浏览器级冒烟，
只跑 `tests/live-smoke.spec.ts`（M95.F04.I02：登录 → 报告审核列表 → act 一发 → Summary 可达）。
API 级 parity 由 contract-test（ADR-0016）兜底，live 不重复。

### 5.1 env 与运行

- `E2E_LIVE_URL`：指 live 后端的 react 实例地址（例 `http://localhost:5206`）
- `E2E_LIVE_API_BASE_URL`：live 后端 API（例 `http://localhost:5204/api`）
- 两键已进 .env.example/.env.test 契约（值留空）；真值仅进程 env 提供——空 = 不注册 live project
- 运行：`E2E_LIVE_URL=http://localhost:5206 E2E_LIVE_API_BASE_URL=http://localhost:5204/api npx --no playwright test live-smoke --project=live`
- 5204/5205 各跑一轮（换 env 重跑）；默认 `npm run e2e` 不含 live

### 5.2 起服差异（对照 §2）

1. react live 实例：`VITE_DEV_PORT=5206 VITE_API_BASE_URL=http://localhost:5204 npm run dev`（5205 轮换 base）——5206 避开 :5202 默认实例与 :5203 vue
2. live 后端起服见 contract-test-run-live.md（各自 .env.local 含 DATABASE_URL；三后端共库 lab_dev）
3. **CORS（两坑）**：springboot 白名单缺省静默用 `5173/5174/3000`（不报错纯拦）——起服必带
   `LAB_CORS_ALLOWED_ORIGINS=http://localhost:5206`；aspnetcore 缺 `LAB_CORS_ALLOWED_ORIGINS`
   直接 throw（fail-fast），配置须含 `http://localhost:5206`
4. 探活：登录即探针（`POST /api/auth/login` fail-fast）；health 端点三端各异
   （aspnetcore=/health、springboot=/actuator/health、nextjs=/api/health）不作为 live 前置
5. live act 消耗 lab_dev 种子行（四阶段各 30；e2e 默认轮 globalSetup reseed 会还原翻转行）
