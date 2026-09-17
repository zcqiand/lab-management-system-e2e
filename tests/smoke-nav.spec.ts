// M95.F02.I07 冒烟导航：会话预置后逐路由直航（page.goto，不走侧边栏——
// saas 不可达时后端 /auth/menus 返回 200 []（空快照，已核实），三端侧边栏为空，点导航不可行，已登记分歧）。
// 每路由断言：无页面级 JS 崩溃（pageerror）、无 /api/** 5xx。
// 路由清单取三端并集的「公共子集」：/inspection-calculation-rules（vue 缺，登记分歧）、
// /dashboard（react/vue 缺）、各端首页语义分歧（react/vue / vs nextjs /dashboard）均不入清单。
import { test, expect, type Page } from "@playwright/test";
import { loginAndSeed, fnRow, fnRows } from "./helpers";

// 三端全等存在的业务路由（已逐一核实路由表）
const ROUTES = [
  "/contracts",
  "/receipts",
  "/brands",
  "/models",
  "/specifications",
  "/grades",
  "/inspection-technical-requirements",
  "/summary",
] as const;

async function watchFailures(page: Page): Promise<{ errors: string[]; api5xx: string[] }> {
  const failures = { errors: [] as string[], api5xx: [] as string[] };
  page.on("pageerror", (err) => failures.errors.push(String(err)));
  page.on("response", (res) => {
    if (res.url().includes("/api/") && res.status() >= 500) {
      failures.api5xx.push(`${res.status()} ${res.url()}`);
    }
  });
  return failures;
}

test("AC-1 全部公共路由可达：无崩溃、无 API 5xx M95.F02.I07", async ({ page, request }) => {
  await loginAndSeed(page, request);
  const failures = await watchFailures(page);
  for (const route of ROUTES) {
    await page.goto(route);
    // 业务壳已挂载（三端公共锚：合同表首行或任意页面标题区渲染完成即视为可达）
    await expect(page.locator("main, #__next, #root, #app").first()).toBeVisible({ timeout: 15_000 });
    expect(failures.errors, `${route} 出现 pageerror`).toEqual([]);
    expect(failures.api5xx, `${route} 出现 API 5xx`).toEqual([]);
  }
});

test("AC-2 关键列表页有数据行（防死桩假绿）M95.F02.I07", async ({ page, request }) => {
  await loginAndSeed(page, request);
  await page.goto("/contracts");
  await expect(fnRow(page, "M02.F01.I01").first()).toBeVisible({ timeout: 15_000 });
  await page.goto("/brands");
  // superset 行锚（已登记分歧）：字典行 react=tr、vue/nextjs=li
  await expect(
    page.locator('[data-fn="M04.F09.I01"]').locator('tr, li, [role="row"]').first(),
  ).toBeVisible({ timeout: 15_000 });
  await page.goto("/receipts");
  // I01 承载分歧（已登记）：react/vue 行级、nextjs 容器级——fnRows 双路计数
  await expect(fnRows(page, "M03.F01.I01").first()).toBeVisible({ timeout: 15_000 });
});
