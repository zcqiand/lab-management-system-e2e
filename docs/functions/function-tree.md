# 功能清单（Function Tree）— 建筑工程实验室管理系统前端E2E一致性

> **全体系唯一锚点。** 需求、流程、设计、测试都引用这里的 ID。
> 不在这里的 ID 是悬空引用，L5 门会拦。**改功能，先改这份表。**
>
> 本仓使用**保留命名空间 `M95`**（lab 家族 M96 契约验证 / M99 msw 已占）。
> 它不镜像 BASE 业务模块——声明的是「E2E 验证层自己的功能」；
> 用例覆盖的业务子项挂 BASE 的 I 级 ID（跨仓检查方式是命名空间归属，不是集合比对）。
> 依据：suite `docs/adr/0015-contract-test-repo.md`（同款模式）+ `0030-e2e-parity-repo.md`
> + `0033-lab-family-align-saas-reform.md`（lab 家族建仓授权）。

## 编号规则

| 层级 | 名称 | 格式 | 含义 |
|---|---|---|---|
| 一级 | 功能模块 | `M01` | 业务域边界，通常对应一级菜单 |
| 二级 | 功能 | `M01.F01` | 一个完整业务步骤 / 独立闭环流程 / 数据管理页面 |
| 三级 | 功能子项 | `M0x.F0y.I0z` | 技术交付单元 / 权限挂载点。对应一个 API 接口、页面组件、图表区块或权限控制点 |

**硬规则**

1. 编号单调递增，永不复用。废弃改状态，不删行。
2. 子项编号必须以父级为前缀。
3. 一个子项 = 一个权限点。权限码即 ID，不另起一套编码。
4. 拆不出子项的功能 → 它其实是子项，往上并。子项超 20 个 → 它其实是模块，往下拆。

**状态**：`规划` | `开发中` | `已上线` | `已废弃`
**子项类型**：`页面` | `标签页` | `查询` | `按钮` | `报表` | `接口`
**交付**：`前端+后端` | `仅前端` | `仅后端` | `后端`

---

## 模块总览

| 模块 ID | 模块名称 | 说明 | 状态 |
|---|---|---|---|
| M01 | （init_project 占位） | 从未是真实功能；本仓真实模块见 M95 | 已废弃 |
| M95 | 前端 E2E 一致性验证 | 同一套 Playwright 用例指 lab 三前端地址，验交互/状态/异常路径三端一致 | 已上线 |

---

## M01 （init_project 占位）

| 功能 ID | 功能名称 | 说明 | 状态 |
|---|---|---|---|
| M01.F01 | （init_project 占位） | | 已废弃 |

> M01.F01 下无 I 级子项——唯一子项 M01.F01.I01 为脚手架空行，已按维护约定移入
> 「已废弃功能子项」段（见文末），号不回收。

---

## M95 前端 E2E 一致性验证

> 保留命名空间，依据 ADR-0030 + ADR-0033。用例覆盖的业务子项挂 BASE 的 I 级 ID，不在此重复登记。
> 与 saas-e2e 的模型差异（lab 家族实情，用例内已登记分歧）：
> 登录是 SSO orchestrator（无密码表单，用 API 登录 + storage 预置）、
> msw 菜单快照为空数组（侧边栏不可点，导航走 page.goto）、
> 租户切换无前端 UI（不移植 saas 切换用例）。
> 2026-09-13 首轮联跑新增登记：
> **REF 形状缝**——shared 契约部分列表端点回裸数组（TechnicalRequirement[] 等），
> 三端 REF 页面一律读 `{items,total}` 且按 `id` 寻址行；msw 保持契约形状不动，
> 桥接放测试缝（`tests/helpers.ts installRefShapeAdapters`，镜像 react 仓
> `tests/helpers/seed.ts installShapeAdapters` 家族先例）；
> **委托书锚语义**——react/vue 的 I03=删除/I04=提交，nextjs 的 I03=编辑/I04=删除，
> 弹窗保存键三端均无 data-fn（superset 锚文本）；
> **技术要求 UI 分歧**——react/vue 平铺表格 vs nextjs 二级树（检测项目→检测标准）；
> **行 DOM 分歧**——vue Table 原语 shadcn 迁移（Phase 2a-1）后行是 div[role=row]（无 tr
> 元素；技术要求行级不带 data-fn，仅容器 I01）→ superset 行定位 `fnRow`/`textRow`
> （锚 data-fn/文本，不锚标签）；
> **合同保存锚分歧**——react/vue 保存钮 = I02，nextjs = I03 且新建态文案「创建」、
> 行内操作按钮无 data-fn（superset：data-fn 双锚 + 文案正则）；
> **表单 Label 关联三形态**——react htmlFor / nextjs aria-label / vue 无关联，
> 字段定位 getByLabel 优先、「label 兄弟节点」兜底（helpers fillByLabel* 已内置）；
> msw 列表 newest-first（家族约定，同 audit occurred_at DESC）。

| 功能 ID | 功能名称 | 说明 | 状态 |
|---|---|---|---|
| M95.F01 | 三端参数化运行 | 同一套 Playwright 用例 × 三个 baseURL（nextjs/react/vue）跑三遍；用例分叉即 parity 失效 | 已上线 |
| M95.F02 | 行为锚点断言 | 选择器锚 `data-fn`，断言锚用户可观察行为（行增删/loading/跳转/提示），不锚 DOM 与组件库 | 已上线 |
| M95.F03 | trace 映射 | Playwright 结果 → 本仓 `.state/trace.json` 的 I 级 ID 映射（fnReporter onFinished 教训内置） | 已上线 |
| M95.F04 | 后端目标 | 默认真后端 lab-nextjs :5201（msw 已删，9c51c84 切真）；live 冒烟=react 实例指 5204/5205（M95.F04.I02，e2e-runtime.md §5） | 已上线 |

### M95.F01 三端参数化运行

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M95.F01.I01 | Playwright 三端 project 配置 | 接口 | 后端 | 同一 spec × nextjs/react/vue 三个 baseURL project；URL 走 env fail-fast，禁默认值兜底 | 已上线 |
| M95.F01.I02 | 仓内基建契约自检 | 接口 | 后端 | env 两份契约 key 全等 / projects 顺序固定 / 起服文档含 4 端口 / trace 产物落点——不依赖被测服在场 | 已上线 |

### M95.F02 行为锚点断言

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M95.F02.I01 | SSO 登录主流程用例 | 接口 | 后端 | authorize 参数完整且真实跳转 + state 篡改拒绝发 callback（防 CSRF）+ state 匹配换 JWT 落 storage；覆盖 BASE M01.F05.I01。saas IdP 侧已由 saas-e2e 覆盖，此处 route 虚拟化 | 已上线 |
| M95.F02.I02 | 合同管理 CRUD 用例 | 接口 | 后端 | 列表/创建/编辑/删除 × 三端；写操作自产自销（uniqueCode）；删除确认三端形态分歧已登记（superset helper）；覆盖 BASE M02.F01 | 已上线 |
| M95.F02.I03 | 会话用例（预置+登出） | 接口 | 后端 | API 登录 + storage 预置后业务页可达；登出清 storage 落登录页。切换租户在 lab 无前端 UI，不移植（登记 docs/requirements）；覆盖 BASE M00.F01 + M01.F05 登出 | 已上线 |
| M95.F02.I04 | 委托书 CRUD 用例 | 接口 | 后端 | 列表/创建/编辑/删除 × 三端；表单规模分歧（只填公共必填字段）与行锚语义分歧（superset 锚文本）已登记；覆盖 BASE M03.F01 | 已上线 |
| M95.F02.I05 | 字典 CRUD 用例 | 接口 | 后端 | 以 /brands 抽样 CategoryDictList 三端共用件：选有 seed 行的类别→新建→行出现→删除→行消失；覆盖 BASE M04.F09 | 已上线 |
| M95.F02.I06 | 技术要求 CRUD 用例 | 接口 | 后端 | 新建（项目/参数下拉+文本组）→行数增长→删除→回落 × 三端；REF 形状缝由 installRefShapeAdapters 桥接；UI 分歧（平铺表格 vs 二级树）superset 行定位；覆盖 BASE M06.F06 | 已上线 |
| M95.F02.I07 | 冒烟遍历用例 | 接口 | 后端 | 会话预置后逐公共路由 page.goto（msw 菜单快照为空，侧边栏不可点——登记分歧）：无 pageerror、无 /api/** 5xx、关键列表行数>0 —— 直击死桩假绿 | 已上线 |
| M95.F02.I08 | 三端 UI 结构指纹用例 | 接口 | 后端 | 合同表头全等、行操作按钮、品牌/技术要求容器锚逐项断言三端一致；已登记分歧页（汇总/报表/登录页锚）不入断言 | 已上线 |
| M95.F02.I09 | 数据录入用例 | 接口 | 后端 | 会话预置 → /data-entry（flowStatus=data_entry 列表）→ 行内「录入结果」→ 弹窗样品/参数就位 → 检测结果唯一值保存重开回读持久 + 二次保存更新落定 × 三端；保存=create/update 双语义（种子 150 条 test_records 键 sample#param）；分歧登记：三态过滤器三端零实现、人工改判无独立锚、nextjs 弹窗内样品级 CRUD 独有；覆盖 BASE M03.F03 | 已上线 |
| M95.F02.I10 | 报告工作流用例 | 接口 | 后端 | 四阶段（/report-review·approve·issue·archive）×2 用例：种子态列表渲染 + act 提交态前移（首行 WS code 提交后离开阶段列表；F08 例外=归档终态自转移：act ok 但行留存，断言 act 接受+行留存；react/vue=勾选+批量提交 I02，nextjs=行内提交钮 I07/I05——交互分歧按 project 收敛）；FlowAction=submit/return/withdraw；act 消耗预算 12 行/轮 << 存量 30，禁计数断言；测试缝：lab-auth operator 预置（nextjs act 需 authStore user）；原 installCorsBridge 缝已删（2026-09-22 lab-nextjs CORS 中间件治本）；分歧登记：三态过滤器 I04 三端零实现、查看详情仅 nextjs（路由跳 /receipts/{id}）、vue 反馈走 alert、nextjs 阶段页带「我提交的（可撤回）」第二张表、表形态三分（react `<table>` 行带锚 / vue div[role=table] / nextjs 容器双表）、I01/I02 三端同 ID 异义（归 tree-change 批与 M03.F03 并案）；覆盖 BASE M03.F05-F08 | 已上线 |
| M95.F02.I11 | Summary 用例 | 接口 | 后端 | /summary 结构断言 ×3 端：汇总表动态列表头+数据行在位（I01 容器锚三端同名异义已登记；表 DOM 三分——vue div[role=table] 无真 table，union superset 治）；统计面 superset（react/vue=I02 统计卡「合同数/接样数/样品数」，nextjs=I02 容器+I03 指标卡+I04 漏斗 testid）；禁数字 parity——nextjs /api/summary 读 msw fixtures 不读 DB（登记后端批）；原 installCorsBridge 缝已删（2026-09-22 lab-nextjs CORS 中间件治本）；覆盖 BASE M05.F01 现状面 | 已上线 |

### M95.F03 trace 映射

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M95.F03.I01 | Playwright→trace.json 映射器 | 接口 | 后端 | Playwright 结果 → 本仓 .state/trace.json（schema 1）；只收本命名空间 M95.*；skip 用例 fns 必空 | 已上线 |

### M95.F04 后端目标

| 子项 ID | 名称 | 类型 | 交付 | 说明 | 状态 |
|---|---|---|---|---|---|
| M95.F04.I01 | 真后端默认目标接线 | 接口 | 后端 | 三前端 dev server 的 API 指向 lab-nextjs :5201（2026-09-17 msw 仓已删切真，勘误 2026-09-22：原文 msw :5200/__e2e/reset 已过时）；globalSetup 跑 shared seed-db upsert 重灌 + nextjs 暖机；DB=lab_dev（E2E_DATABASE_URL） | 已上线 |
| M95.F04.I02 | live 冒烟接线 | 接口 | 后端 | E2E_LIVE_URL/E2E_LIVE_API_BASE_URL 进程 env 提供时注册 live project（默认 npm run e2e 不含，opt-in 双向 testMatch 隔离）；live-smoke（react 实例 :5206）登录→报告列表→act 一发→Summary 可达，5204/5205 各一轮；springboot CORS 白名单须显式带 :5206（静默默认 5173），aspnetcore 缺 LAB_CORS_ALLOWED_ORIGINS 即 throw；三后端共库 lab_dev，live act 消耗由 reseed 还原 | 已上线 |

---

## 已废弃功能子项

> 所有 `已废弃` / `已迁移` 状态的功能子项统一汇总到这里，**按子项 ID 顺序排列**。
> 模块级（F 级及以上）的已废弃 / 已迁移状态保留在各模块章节内说明；本节只收 I 级。
>
> 列字段说明：
> - **模块归属**：该 I 所属 F 所在模块（用于跨模块检索）
> - **迁移去向**：若为「已迁移」，标注新 ID；若为「已废弃」，说明废弃原因

| 子项 ID | 名称 | 模块归属 | 迁移去向 | 状态 |
|---|---|---|---|---|
| M01.F01.I01 | （init_project 占位） | M01 | 已废弃（脚手架空行，非真实功能） | 已废弃 |

---

## 维护约定

- 谁改功能，谁改表，同一个 commit。
- `规划` → `开发中`：必须先有需求文档引用它。
- `开发中` → `已上线`：L5 会警告它缺设计映射与测试引用。警告不阻断，由人裁量。
- **已废弃 / 已迁移 I 级子项**：从原 F 段移到「已废弃功能子项」段，不删除行；F 级保留在新结构下。
