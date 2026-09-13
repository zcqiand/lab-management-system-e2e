// M95.F02.I08 UI 一致性指纹：三端同页面同锚同文案（ADR-0015「前端不可区分」的 UI 抽样）。
// 抽样面：合同表头全等 + 行操作按钮 + 品牌字典容器 + 技术要求容器。
// 已登记分歧不入断言：汇总页语义（I01/I02 互换）、报表阶段锚位、登录页锚、侧边栏锚。
import { test, expect } from "@playwright/test";
import { loginAndSeed, fnRow } from "./helpers";

test("AC-1 合同表头三端全等 M95.F02.I08 覆盖 M02.F01.I01", async ({ page, request }) => {
  await loginAndSeed(page, request);
  await page.goto("/contracts");
  await expect(fnRow(page, "M02.F01.I01").first()).toBeVisible({ timeout: 15_000 });
  // superset 表头：react/nextjs 真 thead th；vue shadcn 迁移后 div[role=columnheader]
  const headers = await page.locator('thead th, [role="columnheader"]').allTextContents();
  expect(headers.map((h) => h.trim())).toEqual([
    "合同编号",
    "项目名称",
    "委托单位",
    "见证人",
    "状态",
    "委托日期",
    "操作",
  ]);
});

test("AC-2 合同行操作含编辑/删除 M95.F02.I08 覆盖 M02.F01.I03", async ({ page, request }) => {
  await loginAndSeed(page, request);
  await page.goto("/contracts");
  const row = fnRow(page, "M02.F01.I01").first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByRole("button", { name: "编辑" })).toBeVisible();
  // 删除锚分歧（已登记）：react/vue 行内 I03；nextjs 行内按钮无 data-fn（可观察
  // 文本「删除」）。确认交互形态分歧另登记（react ConfirmModal / vue ConfirmDialog /
  // nextjs 原生 confirm）
  await expect(row.getByRole("button", { name: "删除", exact: true })).toBeVisible();
});

test("AC-3 品牌字典与技术要求容器锚三端同构 M95.F02.I08 覆盖 M04.F09.I01 + M06.F06.I01", async ({ page, request }) => {
  await loginAndSeed(page, request);
  await page.goto("/brands");
  await expect(page.locator('[data-fn="M04.F09.I01"]').first()).toBeVisible({ timeout: 15_000 });
  await page.goto("/inspection-technical-requirements");
  await expect(page.locator('[data-fn="M06.F06.I01"]').first()).toBeVisible({ timeout: 15_000 });
});
