// M95.F02.I11 Summary 用例（覆盖 BASE M05.F01 现状面）。已查实三端锚（2026-09-22 recon）：
//   - 三端均 [data-fn="M05.F01.I01"]，同名异义（react/vue=根容器，nextjs=汇总表 section）——
//     容器可见性断言可直接共用；
//   - 汇总表列头由后端 data.columns 动态渲染（三端同构）——禁逐字列头，断言表头/行在位；
//   - 统计面分歧：react/vue=[data-fn="M05.F01.I02"] 统计卡 grid（合同数/接样数/样品数/待办任务/
//     按状态分布）；nextjs=I02 仪表盘容器 + I03 指标卡（data-testid=dashboard-metrics，今日试验
//     总数）+ I04 漏斗（data-testid=dashboard-funnel，待取样/已收样/…）——按 project 分叉断言；
//   - 禁数字 parity 断言：nextjs /api/summary[/stats] 读 msw fixtures 不读 DB（登记后端批），
//     react/vue 实算——跨端数字必不同源，只断结构与在位性。
// 偏离登记（2026-09-22 实测，对 brief 骨架的增补，均沿家族先例）：
//   ① installCorsBridge 测试缝——react/vue（:5202/:5203）跨源调 :5201 被浏览器拦
//     （lab-nextjs /api/* 无 CORS 中间件，后端批未落地）；不加则 /summary 三源任一
//     被拦即整页 PageLoading，I01 永不可见。波1 data-entry.spec.ts 同款逐字拷贝，
//     后端补 CORS 后本缝可整体删除（同源分支 route.fallback 零干预）。
//   ② 表 DOM 形态三分——vue Table 原语 shadcn 迁移后**故意 div-based**（Table.vue:5-7
//     注释查实：role=table/row/columnheader/cell，无 <table>/<thead>/<tbody> 元素），
//     brief 骨架的 page.locator("table")+thead th+tbody tr 对 vue 恒 0。改 I01 容器内
//     「真 table ∪ [role=table]」union + 「th ∪ [role=columnheader]」+「tbody tr ∪
//     含 [role=cell] 的 [role=row]」superset（report-workflow stageTable 同款先例）。
//   ③ spec 局部 timeout 放宽 90s——vue vite dev 冷编译首导航可超 config 默认 30s
//     （波1/Task1 同款先例，report-workflow 偏离登记⑥），本文件级放宽吸收。
import { test, expect, type Page } from "@playwright/test";
import { loginAndSeed, armNativeDialogAccept } from "./helpers";
import { requireE2eEnv } from "../src/env";

test.setTimeout(90_000); // 偏离登记③（vue 冷编译，spec 局部不动全局）

/** CORS 测试缝（波1 data-entry.spec.ts 同款逐字拷贝，登记见文件头偏离①）。 */
async function installCorsBridge(page: Page): Promise<void> {
  const apiOrigin = new URL(requireE2eEnv("E2E_API_BASE_URL")).origin;
  await page.route(`${apiOrigin}/**`, async (route) => {
    const req = route.request();
    const origin = req.headers().origin;
    if (!origin || origin === apiOrigin) return route.fallback();
    const corsHeaders: Record<string, string> = {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
    };
    if (req.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          ...corsHeaders,
          "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers":
            req.headers()["access-control-request-headers"] ?? "content-type,authorization",
          "access-control-max-age": "86400",
        },
      });
    }
    try {
      const res = await route.fetch();
      await route.fulfill({ response: res, headers: corsHeaders });
    } catch {
      await route.fallback();
    }
  });
}

test.beforeEach(async ({ page, request }) => {
  await armNativeDialogAccept(page);
  await installCorsBridge(page); // react/vue 跨源调 :5201 被 CORS 拦——见偏离登记①
  await loginAndSeed(page, request);
  await page.goto("/summary");
});

/** I01 汇总表定位（偏离登记②）：react/nextjs=真 <table>，vue=[role="table"] div——
 *  锚 I01 容器内双路 union，.first() 按 DOM 序取（本页仅此一表，序唯一）。 */
function summaryTable(page: Page) {
  return page
    .locator('[data-fn="M05.F01.I01"] table, [data-fn="M05.F01.I01"] [role="table"]')
    .first();
}

/** 汇总表数据行 superset（偏离登记②）：tbody tr（react/nextjs）∪ 含 [role=cell] 的
 *  [role=row]（vue 数据行；表头行只含 [role=columnheader]，天然排除）。 */
function dataRows(table: ReturnType<Page["locator"]>) {
  return table.locator('tbody tr, [role="row"]:has([role="cell"])');
}

test("AC-1 /summary 汇总表结构与种子行在位 M95.F02.I11 覆盖 M05.F01.I01", async ({ page }) => {
  await expect(page.locator('[data-fn="M05.F01.I01"]')).toBeVisible({ timeout: 15_000 });
  // 列头动态渲染：断言表头单元格非空 + 至少一行数据（结构性断言，禁逐字列头/禁计数）
  const table = summaryTable(page);
  await expect(table.locator('th, [role="columnheader"]').first()).toBeVisible({ timeout: 15_000 });
  await expect(dataRows(table).first()).toBeVisible({ timeout: 15_000 });
  // 种子行可见（spec §3.2：commissionCode 行）：首行含接样单号前缀 WS-2026-（结构性，禁逐字列头/禁计数）
  await expect(dataRows(table).first()).toContainText(/WS-2026-/, { timeout: 15_000 });
});

test("AC-2 统计面在位：卡/漏斗 superset M95.F02.I11 覆盖 M05.F01.I02", async ({ page }) => {
  if (test.info().project.name === "nextjs") {
    await expect(page.locator('[data-fn="M05.F01.I02"]')).toBeVisible({ timeout: 15_000 }); // 仪表盘容器
    await expect(page.locator('[data-testid="dashboard-metrics"]')).toBeVisible(); // I03 指标卡
    await expect(page.locator('[data-testid="dashboard-funnel"]')).toBeVisible();  // I04 漏斗
    await expect(page.getByText("今日试验总数")).toBeVisible();
    return;
  }
  const cards = page.locator('[data-fn="M05.F01.I02"]'); // react/vue 统计卡 grid
  await expect(cards).toBeVisible({ timeout: 15_000 });
  await expect(cards.getByText("合同数")).toBeVisible();
  await expect(cards.getByText("接样数")).toBeVisible();
  await expect(cards.getByText("样品数")).toBeVisible();
});
