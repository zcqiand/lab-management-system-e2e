// M95.F01.I01：三端参数化运行（ADR-0030 Decision 2，lab 家族落地 ADR-0033 阶段三）。
// 同一套 spec × 三个 project（nextjs/react/vue）；用例分叉即 parity 失效。
// 前置（M95.F04.I01）：lab-msw :5200 与三前端 dev server 由外部起好，本仓不自起 ——
// 起服约定见 docs/conventions/e2e-runtime.md。env 缺失在此处 fail-fast。
import { defineConfig, devices } from "@playwright/test";
import { requireE2eEnv } from "./src/env";

const TARGETS = [
  { name: "nextjs", urlEnv: "E2E_NEXTJS_URL" },
  { name: "react", urlEnv: "E2E_REACT_URL" },
  { name: "vue", urlEnv: "E2E_VUE_URL" },
] as const;

export default defineConfig({
  testDir: "tests",
  globalSetup: "./src/global-setup.ts",
  globalTeardown: "./src/global-teardown.ts",
  timeout: 30_000,
  // 三端共享一个 msw :5200（有状态）——断言全部唯一 code/brand 基（页面作用域 +
  // hasText 唯一值，无跨端计数断言）后可安全并行，写操作互不寻址冲突
  workers: 1, // 串行求确定性（共享 msw 偶发空态假红 probe13 曾误归因并行负载；真根因 nextjs dev 冷编译+count 竞态，已由 globalSetup 暖机+helpers waitFor 根治）。wall ~4min 仍远低于 900s
  retries: 1, // 浏览器 E2E flaky 缓解（REQ-2026-001 风险表）
  reporter: [["list"], ["./src/trace-reporter.ts"]],
  // ADR-0030 Decision 2：projects 顺序即 parity 报告呈现顺序，勿随意调整。
  projects: TARGETS.map((t) => ({
    name: t.name,
    use: { ...devices["Desktop Chrome"], baseURL: requireE2eEnv(t.urlEnv) },
  })),
});
