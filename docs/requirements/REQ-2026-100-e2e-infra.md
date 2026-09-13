# REQ-2026-100 建仓基建：三端参数化 + trace + 门/CI + msw reset 接线

| 项 | 值 |
|---|---|
| 提出人 | 项目所有者 |
| 提出日期 | 2026-09-13 |
| 优先级 | P0 |
| 状态 | 已验收 |
| 关联 ADR | ADR-0033（lab 家族建仓授权）；ADR-0030（saas-e2e 先例全量移植） |

## 1. 需求描述

> **用户原话（2026-09-12，ADR-0033 阶段三裁决）**：「增加 e2e 仓」「全量移植」saas-e2e 的
> 10 条 Playwright specs 到 lab 家族。

**我的理解**：lab 家族补齐与 saas 同款的 E2E 一致性验证层——同一套用例 ×
nextjs/react/vue 三个 baseURL 跑三遍，用例分叉即 parity 失效；
被测后端默认 lab-msw :5200（ADR-0012 HTTP 中间件模式），
全局 setup 调 `/api/v1/__e2e/reset` 归零 fixtures 保证用例间隔离。

### 澄清记录

| 疑问 | 结论 | 澄清人 | 日期 |
|---|---|---|---|
| lab 登录模型与 saas 本质不同（SSO orchestrator，无密码表单） | 用例改用 API 登录 + localStorage 预置建会话（三端 key 名不同，全量预置，spec 不分叉）——saas AC-4 全集断言先例 | — | 2026-09-13 |
| msw /auth/menus 登录后返回 200 []，三端侧边栏为空 | 冒烟遍历不走侧边栏点击，改逐路由 page.goto（登记分歧） | — | 2026-09-13 |
| saas 用例中「切换租户」在 lab 无前端 UI（单租户换发语义） | 不移植该用例，登记 docs/requirements（本行） | — | 2026-09-13 |
| lab-msw 无 /api/v1/__e2e/reset 端点 | lab-msw 仓同批新增（镜像 saas-msw 2026-09-11 先例），本仓 global-setup 调它 | — | 2026-09-13 |

## 2. 验收标准

| 编号 | 场景 | 操作 | 预期 |
|---|---|---|---|
| AC-1 | 冷仓 | `npm install`（npmmirror）+ `npm run e2e`（4 被测进程在场） | 三 project 全绿退出 |
| AC-2 | 缺 env | 任一 E2E_* 缺失直接 `npm run e2e` | fail-fast 报缺失 key，禁默认值兜底（ADR-0019） |
| AC-3 | 跑测后 | 读 `.state/trace.json` | schema 1，fns 只含 M95.*，skip 用例 fns 空 |
| AC-4 | 跑测后 | 连跑两轮 `npm run e2e` | 第二轮仍全绿（reset 隔离生效，不吃上一轮残数据） |
| AC-4b | CI | tag v* / nightly / 手动触发 | sibling checkout 4 被测仓 + healthcheck + playwright + 产物上传 |

## 3. 功能影响

| 功能 ID | 名称 | 影响类型 | 说明 |
|---|---|---|---|
| M95.F01.I01 | Playwright 三端 project 配置 | 新增 | 同 spec × 3 baseURL，env fail-fast |
| M95.F01.I02 | 仓内基建契约自检 | 新增 | env key 全等 / projects 顺序 / 起服端口 / trace 落点，静态断言不依赖被测服 |
| M95.F03.I01 | Playwright→trace.json 映射器 | 新增 | 只收 M95.*，Map 去重，onEnd 落盘 |
| M95.F04.I01 | lab-msw 默认目标接线 | 新增 | :5200 + reset 端点（lab-msw 仓配套） |

## 4. 风险与回滚

删仓即回滚（lab-msw 的 reset 端点独立 commit 可单独 revert）。
风险：三前端 dev server 端口占用/启动顺序——已写进 docs/conventions/e2e-runtime.md 起服清单。
