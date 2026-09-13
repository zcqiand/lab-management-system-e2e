# 设计与功能对齐 — 建筑工程实验室管理系统前端E2E一致性

> 人填、人评审。机器只检查功能 ID 存在性。
> 回答一个问题：**这个功能子项，落到哪段代码、哪张表、哪个权限码上？**
> 答不上来的行，说明设计没做完，别开工。

## 映射表

| 功能子项 ID | 页面/组件 | 接口 | 数据表 | 权限码 | 设计稿 | 状态 |
|---|---|---|---|---|---|---|
| M95.F01.I01 | playwright.config.ts（三 project） | — | — | — | ADR-0030 Decision 2 | 已上线 |
| M95.F01.I02 | tests/infra-contract.spec.ts | — | — | — | ADR-0030 Decision 7（仓内自检变体） | 已上线 |
| M95.F02.I01 | tests/login.spec.ts | — | — | — | RFC 6749 §4.1 + saas-e2e oauth-jump 先例 | 已上线 |
| M95.F02.I02 | tests/contract-crud.spec.ts | — | — | — | REQ-2026-101 AC + ADR-0030 Decision 4 | 已上线 |
| M95.F02.I03 | tests/session.spec.ts | — | — | — | REQ-2026-102 AC | 已上线 |
| M95.F02.I04 | tests/receipt-crud.spec.ts | — | — | — | REQ-2026-103 AC | 已上线 |
| M95.F02.I05 | tests/dict-crud.spec.ts | — | — | — | REQ-2026-104 AC | 已上线 |
| M95.F02.I06 | tests/techreq-crud.spec.ts | — | — | — | REQ-2026-105 AC | 已上线 |
| M95.F02.I07 | tests/smoke-nav.spec.ts | — | — | — | saas-e2e 方案 A（page.goto 变体：msw 菜单快照为空） | 已上线 |
| M95.F02.I08 | tests/ui-parity.spec.ts | — | — | — | saas-e2e 用户裁定 2026-09-11（抽样移植） | 已上线 |
| M95.F03.I01 | src/trace-reporter.ts | — | — | — | suite 契约二（harness.py） | 已上线 |
| M95.F04.I01 | src/global-setup.ts + docs/conventions/e2e-runtime.md | — | — | — | ADR-0033 阶段三 + ADR-0030 Decision 3 | 已上线 |

## 约定

1. **权限码 = 功能子项 ID。** 前端按钮的权限判断直接写 ID。
2. 一个接口服务多个子项时，多行重复写。不要为表好看而合并 —— 合并后看不清接口还有没有别的调用方。
3. 状态列必须与功能清单一致。不一致以功能清单为准。

## 评审时问这三个问题

1. 有没有子项没有权限码？→ 那它就是任何人都能点的按钮
2. 有没有一张表被三个以上模块直接写入？→ 边界破了
3. 「开发中」的行里接口和表填了吗？→ 没填就是还在纸上，别报进度
