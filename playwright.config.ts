// M95.F01.I01：三端参数化运行（ADR-0030 Decision 2，lab 家族落地 ADR-0033 阶段三）。
// 同一套 spec × 三个 project（nextjs/react/vue)；用例分叉即 parity 失效。
// 前置（M95.F04.I01）：lab-nextjs :5201（真 API 后端）与三前端 dev server 由外部起好，
// 本仓不自起 —— 起服约定见 docs/conventions/e2e-runtime.md。env 缺失在此处 fail-fast。
import { defineConfig, devices } from "@playwright/test";
import { requireE2eEnv } from "./src/env";

const TARGETS: { name: string; urlEnv: string }[] = [
  { name: "nextjs", urlEnv: "E2E_NEXTJS_URL" },
  { name: "react", urlEnv: "E2E_REACT_URL" },
  { name: "vue", urlEnv: "E2E_VUE_URL" },
];
// live 位（M95.F04.I02）：E2E_LIVE_URL 仅 live 冒烟手动运行时由进程 env 提供；
// 缺省/空 = 不注册 live project，默认 npm run e2e 不受影响（起服见 e2e-runtime.md §5）。
if (process.env.E2E_LIVE_URL) TARGETS.push({ name: "live", urlEnv: "E2E_LIVE_URL" });

export default defineConfig({
  testDir: "tests",
  globalSetup: "./src/global-setup.ts",
  globalTeardown: "./src/global-teardown.ts",
  timeout: 30_000,
  // 三端共享一个有状态真后端（lab-nextjs :5201，DB 持久化）——断言全部唯一
  // code/brand 基（页面作用域 + hasText 唯一值，无跨端计数断言）后可安全并行，
  // 写操作互不寻址冲突
  workers: 1, // 串行求确定性（共享后端偶发空态假红 probe13 曾误归因并行负载；真根因 nextjs dev 冷编译+count 竞态，已由 globalSetup 暖机+helpers waitFor 根治）。wall ~4min 仍远低于 900s
  retries: 1, // 浏览器 E2E flaky 缓解（REQ-2026-001 风险表）
  reporter: [["list"], ["./src/trace-reporter.ts"]],
  // ADR-0030 Decision 2：projects 顺序即 parity 报告呈现顺序，勿随意调整。
  projects: TARGETS.map((t) => ({
    name: t.name,
    // live project 只跑 live-smoke；默认三 project 永不跑它（opt-in 双向隔离）
    testMatch: t.name === "live" ? /live-smoke\.spec\.ts$/ : undefined,
    testIgnore: t.name === "live" ? undefined : /live-smoke\.spec\.ts$/,
    use: { ...devices["Desktop Chrome"], baseURL: requireE2eEnv(t.urlEnv) },
  })),
});
