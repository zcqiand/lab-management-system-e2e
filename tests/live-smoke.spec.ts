// M95.F04.I02 live 冒烟（react 实例指 live 后端 5204/5205）。
// 本 spec 只被 live project 跑（playwright.config testMatch 隔离）；默认 npm run e2e 不含。
// live 前端 = react dev server :5206（VITE_DEV_PORT=5206 VITE_API_BASE_URL=http://localhost:520X），
// 起服与 CORS 坑见 docs/conventions/e2e-runtime.md §5；登录即探针（fail-fast），不桥 CORS。
import { test, expect } from "@playwright/test";
import { armNativeDialogAccept, loginAndSeedAt, fnRows } from "./helpers";
import { requireE2eEnv } from "../src/env";

const LIVE_API = requireE2eEnv("E2E_LIVE_API_BASE_URL");

test.beforeEach(async ({ page, request }) => {
  await armNativeDialogAccept(page);
  await loginAndSeedAt(page, request, LIVE_API);
});

test("live 冒烟：登录→报告审核列表→act 一发→Summary 可达 M95.F04.I02", async ({ page }) => {
  await page.goto("/report-review");
  const row = fnRows(page, "M03.F05.I01").first(); // live 前端=react：行锚 I01
  await expect(row).toBeVisible({ timeout: 15_000 });
  const text = (await row.textContent()) ?? "";
  const code = text.match(/WS-\d{4}-[A-Za-z0-9-]+/)?.[0];
  expect(code, `行文本应含委托书编号 WS-*：${text.slice(0, 80)}`).toBeDefined();
  // 表格定位锚 I01 容器（同 report-workflow stageTable），不得 hasText:code 自过滤——
  // 行离开后 hasText 定位归零集，not.toContainText 对「元素不存在」报 element(s) not found
  // 而非 pass（2026-09-22 live 双轮红 + expect 语义 probe 实证），绿轮必须在场元素上断言。
  const table = page
    .locator(
      `[data-fn="M03.F05.I01"] table, [data-fn="M03.F05.I01"] [role="table"], ` +
        `table:has([data-fn="M03.F05.I01"]), [role="table"]:has([data-fn="M03.F05.I01"])`,
    )
    .first();
  await row.locator('input[type="checkbox"], [role="checkbox"]').first().click();
  await page.locator('[data-fn="M03.F05.I02"]').first().click();
  await expect(table).not.toContainText(code!, { timeout: 15_000 });
  await page.goto("/summary");
  await expect(page.locator('[data-fn="M05.F01.I01"]')).toBeVisible({ timeout: 15_000 });
});
