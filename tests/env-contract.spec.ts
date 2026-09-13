// M95.F01.I01 契约测试：三端参数化运行的 env 与 project 结构。
// ADR-0030 Decision 2：同一套用例 × 三个 baseURL；用例分叉即 parity 失效。
import { test, expect } from "@playwright/test";
import { requireE2eEnv } from "../src/env";
import cfg from "../playwright.config";

test("三端 baseURL env 全部就绪且互不相同 M95.F01.I01", () => {
  const urls = ["E2E_NEXTJS_URL", "E2E_REACT_URL", "E2E_VUE_URL"].map(requireE2eEnv);
  expect(urls).toHaveLength(3);
  expect(new Set(urls).size).toBe(3);
});

test("config 声明恰好三个 project：nextjs/react/vue（顺序固定）M95.F01.I01", () => {
  const projects = (cfg as { projects?: { name: string }[] }).projects ?? [];
  expect(projects.map((p) => p.name)).toEqual(["nextjs", "react", "vue"]);
});
