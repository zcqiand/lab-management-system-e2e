// M95.F01.I02 基建契约：本仓自身的仓内自检（不依赖 lab 服在场，CI 无起服也能跑）。
// 锁四件事：env 两份契约 key 集合全等；三项目固定顺序；运行时约定文档带起服端口与
// 后端目标条目；trace_reporter 归档产物落 .state/trace.json（schema 1）。
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Playwright 把 spec 转译成 CJS，__dirname 可用（import.meta 不行）
const ROOT = join(__dirname, "..");

function envKeys(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=")[0])
    .sort();
}

test("AC-1 .env.example 与 .env.test key 集合全等 M95.F01.I02", () => {
  const example = envKeys(readFileSync(join(ROOT, ".env.example"), "utf-8"));
  const envTest = envKeys(readFileSync(join(ROOT, ".env.test"), "utf-8"));
  expect(envTest).toEqual(example);
});

test("AC-2 playwright 三项目固定顺序 nextjs→react→vue M95.F01.I02", async () => {
  // Playwright 把 config 转译成 CJS：interop 可能出现双层 default，逐层剥
  const mod = (await import("../playwright.config")) as unknown as Record<string, unknown>;
  const once = (mod.default ?? mod) as Record<string, unknown>;
  const config = (once.default ?? once) as { projects?: { name: string }[] };
  expect(config.projects?.map((p) => p.name)).toEqual(["nextjs", "react", "vue"]);
});

test("AC-3 运行时约定登记了后端目标与 lab 端口段 M95.F01.I02 覆盖 M95.F04.I01", () => {
  const doc = readFileSync(join(ROOT, "docs/conventions/e2e-runtime.md"), "utf-8");
  expect(doc).toContain("M95.F04.I01"); // 后端目标条目（trace 锚点要求）
  expect(doc).toContain("http://localhost:5201/api"); // 真 lab-nextjs API base（msw 剔除后）
  for (const port of ["5201", "5202", "5203"]) {
    expect(doc, `起服清单应含端口 ${port}`).toContain(port);
  }
});

test("AC-4 trace_reporter 声明归档 .state/trace.json（schema 1）M95.F01.I02 覆盖 M95.F03.I01", () => {
  const reporter = readFileSync(join(ROOT, "src/trace-reporter.ts"), "utf-8");
  expect(reporter).toContain(".state/trace.json");
  expect(reporter).toContain("schema: 1");
});
