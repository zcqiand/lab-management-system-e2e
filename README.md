# 建筑工程实验室管理系统前端E2E一致性

同一套 Playwright 用例，参数化三个前端地址（react/vue/nextjs）——验证三端交互、状态与异常路径对用户不可区分（ADR-0030；lab 家族落地见 ADR-0033 阶段三）。

本仓为《（书稿信息待补）》案例（待补）的可运行配套工程，是书稿代码块的 **source of truth**。

## 快速开始

```bash
npm install                 # 安装依赖（registry 走 npmmirror）
cp .env.example .env.local  # 填真值（fail-fast，禁兜底）
# 外部起好 4 个被测进程（msw:5200 + nextjs:5201 + react:5202 + vue:5203）
# 起服约定见 docs/conventions/e2e-runtime.md
npm run e2e                 # 三 project 各跑一遍同一套 spec
```

## 功能特性

按特性分点描述核心功能（见 `docs/functions/function-tree.md`）。

## 技术栈

| 技术 | 版本 |
| :--- | :--- |
| Playwright（@playwright/test） | ^1.63.0 |
| TypeScript | ^7.0.2 |

> 依赖版本与 `version-lock.json` 的 `version_lock` 一致，不引入 lock 外的库。

## 配套书籍及章节映射

| 章 | 主题 | 对应源文件 |
| :--- | :--- | :--- |
| （待补） | | |

## 快速链接

- [CLAUDE.md](CLAUDE.md) — 开发约定与编码规范
- [系统架构.md](docs/ARCHITECTURE.md) — 结构 / 边界 / 数据流 / 决策
- [功能规格.md](docs/functions/function-tree.md) — 功能名称、描述与验收标准
- [E2E 运行时约定](docs/conventions/e2e-runtime.md) — 起服清单 / env / 数据生命周期
- [未来开发计划](PLAN.md) — 待办与迭代方向
- [更新日志](CHANGELOG.md) — 版本变更记录
