// M95.F02.I10 报告工作流用例（覆盖 BASE M03.F05-F08）。已查实三端锚（2026-09-22 recon）：
//   - react/vue：行锚 tr/role=row data-fn="M03.F0x.I01"（fnRows 双路兼容）；批量提交钮
//     data-fn="M03.F0x.I02"（文案 {审核通过|批准|发放|归档完成}（N），需先勾选行）；
//   - nextjs：容器 data-fn="M03.F0x.I01"（行无 data-fn）；行内提交钮 data-fn="M03.F0x.I07"（F05）
//     / "M03.F0x.I05"（F06-F08）；「查看详情」=路由跳 /receipts/{id}（仅 nextjs，登记）；
//   - act：POST /api/receipts/{review|approve|issuance|archived}/act，body {ids, action, operator}；
//     列表 GET /api/receipts?flowStatus={...}；act 后前端 refetch（行离开 = refetch 结果）；
//   - 分歧登记（不入断言）：三态过滤器 I04 三端零实现；查看详情仅 nextjs；vue 提交反馈走
//     globalThis.alert（beforeEach 已 arm）；react=sonner toast；nextjs=role=status 内联条；
//     F08 归档为终态自转移（submit ok 但行不离列表，见用例内偏离登记⑤）；
//     nextjs 阶段页带「我提交的（可撤回）」第二张表（见 stageTable 偏离登记④）。
//   - 写路径纪律：act 真状态迁移消耗种子行——每用例首行一发，一轮 12 行 << 各态存量 30；
//     禁计数断言；残余由 globalSetup reseed 吸收。
// 偏离登记（2026-09-22 实测，对 brief 骨架的唯一增补）：installCorsBridge 测试缝——
//   lab-nextjs :5201 /api/* 无 CORS 中间件（LAB_CORS_ALLOWED_ORIGINS 后端批未落地），
//   react/vue（:5202/:5203）跨源调 :5201 被浏览器拦；波1 data-entry.spec.ts 同款先例，
//   后端补 CORS 后本缝可整体删除（同源分支 route.fallback 零干预）。
import { test, expect, type Page } from "@playwright/test";
import { loginAndSeed, armNativeDialogAccept, fnRows, textRow } from "./helpers";
import { requireE2eEnv } from "../src/env";

/** CORS 测试缝（波1 data-entry.spec.ts 同款逐字拷贝，登记见文件头偏离注释）。 */
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

// 偏离登记⑥：vue vite dev 冷编译首导航可超 15s（2026-09-22 三端全跑实证：F05 渲染
// 首试 15s 行不可见、retry 即绿）——首行可见等待放宽到 30s 吸收；本轮又实证 30s 等待
// 会被 config 默认 test timeout(30s) 截断（F07 渲染首试），故本文件整体放宽到 90s
// （本文件级，不动全局；波1 data-entry.spec.ts 同款「spec 局部放宽」先例）。
test.setTimeout(90_000);
const ROW_VISIBLE_TIMEOUT = 30_000;

interface Phase {
  f: string;             // 阶段短名（F05-F08，标题用）
  route: string;
  rowFn: string;
  reactSubmitFn: string; // react/vue 批量提交钮（勾选行后可用）
  nextActionFn: string;  // nextjs 行内提交钮
  baseActId: string;     // shared 树 act ID（覆盖短语用）
}

// 偏离登记②：brief 骨架 PHASES 条目漏 `f` 字段（接口已声明），逐字采用会渲染出
// 「AC-undefined」标题——补齐骨架本意（阶段短名进标题）。
const PHASES: Phase[] = [
  { f: "F05", route: "/report-review",  rowFn: "M03.F05.I01", reactSubmitFn: "M03.F05.I02", nextActionFn: "M03.F05.I07", baseActId: "M03.F05.I07" },
  { f: "F06", route: "/report-approve", rowFn: "M03.F06.I01", reactSubmitFn: "M03.F06.I02", nextActionFn: "M03.F06.I05", baseActId: "M03.F06.I05" },
  { f: "F07", route: "/report-issue",   rowFn: "M03.F07.I01", reactSubmitFn: "M03.F07.I02", nextActionFn: "M03.F07.I05", baseActId: "M03.F07.I05" },
  { f: "F08", route: "/report-archive", rowFn: "M03.F08.I01", reactSubmitFn: "M03.F08.I02", nextActionFn: "M03.F08.I05", baseActId: "M03.F08.I05" },
];

test.beforeEach(async ({ page, request }) => {
  await armNativeDialogAccept(page);
  await installCorsBridge(page); // react/vue 跨源调 :5201 被 CORS 拦——见文件头偏离登记
  const session = await loginAndSeed(page, request);
  // 偏离登记③：nextjs operator 缝——nextjs FlowStagePage 的 act 需 operator =
  // authStore user.id/username，而 user 只从 zustand persist key「lab-auth」复原
  // （helpers.seedSession 只种 lab.token，fresh profile 下 user=null → runFlow 报
  // 「未登录」直接 return，act 永不发出，2026-09-22 nextjs 首跑 4 连红实证）。
  // 此处用 /auth/me 回读 user 后按 persist 落盘格式 {state:{token,user},version:0}
  // 预置（react/vue 不读此 key，无害 superset——同 helpers「全部预置各端只读自己的」
  // 惯例）；react operator 硬编码 current-user、vue hydrateAuth 自行回读 /auth/me，均不受影响。
  const me = await request.get(`${requireE2eEnv("E2E_API_BASE_URL")}/auth/me`, {
    headers: { authorization: `Bearer ${session.token}` },
  });
  expect(me.status(), "回读 /auth/me 应 200").toBe(200);
  const meBody = (await me.json()) as { user: Record<string, unknown> };
  await page.addInitScript(
    ({ auth }) => {
      window.localStorage.setItem("lab-auth", JSON.stringify({ state: auth, version: 0 }));
    },
    { auth: { token: session.token, user: { ...meBody.user, permissions: [] } } },
  );
});

/** 阶段列表首行定位（nextjs 行无 data-fn，退化为容器内 tbody tr）。 */
function firstRow(page: Page, phase: Phase) {
  if (test.info().project.name === "nextjs") {
    return page.locator(`[data-fn="${phase.rowFn}"] table tbody tr`).first();
  }
  return fnRows(page, phase.rowFn).first();
}

/** 阶段主表定位（act 前后对照用）。brief 骨架原为 page.locator("table", {hasText: code})
 *  ——nextjs 实跑假红（2026-09-22，偏离登记④）：act 成功后行离开阶段表，但同页
 *  阶段表之下还有「我提交的（可撤回）」第二张表，提交行会**按预期**出现在那里，
 *  hasText 定位随之重解析到第二表 → not.toContainText 恒红。改锁阶段表本体；
 *  又实跑发现三端「表」形态分歧（偏离登记④b）：react=真 <table>（行带 data-fn，
 *  容器无）；vue=shadcn 原语 div[role=table]（无 table 元素，同 fnRow 的 div[role=row]
 *  登记）；nextjs=容器 [data-fn=I01] 内两张 <table>（阶段表在前）。四路 union 恰好
 *  三端各中其一路，.first() 按 DOM 序取阶段表；断言语义不变且更准——
 *  「行离开阶段列表」正是被断的行为，行进可撤回区是同页预期呈现。 */
function stageTable(page: Page, phase: Phase) {
  return page
    .locator(
      `[data-fn="${phase.rowFn}"] table, [data-fn="${phase.rowFn}"] [role="table"], ` +
        `table:has([data-fn="${phase.rowFn}"]), [role="table"]:has([data-fn="${phase.rowFn}"])`,
    )
    .first();
}

/** 取首行委托书编号 + 阶段主表定位（act 前后对照用）。 */
async function firstRowCode(page: Page, phase: Phase): Promise<{ code: string; table: ReturnType<Page["locator"]> }> {
  const row = firstRow(page, phase);
  await expect(row).toBeVisible({ timeout: ROW_VISIBLE_TIMEOUT });
  const text = (await row.textContent()) ?? "";
  const m = text.match(/WS-\d{4}-[A-Za-z0-9-]+/);
  expect(m, `行文本应含委托书编号 WS-*：${text.slice(0, 80)}`).not.toBeNull();
  return { code: m![0], table: stageTable(page, phase) };
}

/** 对首行发一次 act（react/vue=勾选+批量提交；nextjs=行内提交钮）。 */
async function actFirstRow(page: Page, phase: Phase): Promise<void> {
  if (test.info().project.name === "nextjs") {
    await page.locator(`[data-fn="${phase.nextActionFn}"]`).first().click();
    return;
  }
  const box = firstRow(page, phase).locator('input[type="checkbox"], [role="checkbox"]').first();
  await box.click();
  await page.locator(`[data-fn="${phase.reactSubmitFn}"]`).first().click();
}

for (const phase of PHASES) {
  test(`AC-${phase.f} ${phase.route} 列表渲染种子态行 M95.F02.I10 覆盖 ${phase.rowFn}`, async ({ page }) => {
    await page.goto(phase.route);
    await firstRowCode(page, phase); // 行可见 + code 可提取即断言成立
  });

  test(`AC-${phase.f} ${phase.route} act 提交后行离开阶段列表 M95.F02.I10 覆盖 ${phase.baseActId}`, async ({ page }) => {
    await page.goto(phase.route);
    const { code, table } = await firstRowCode(page, phase);
    // F08 偏离登记⑤（2026-09-22 nextjs 实测 + 后端 db-queries.ts actForStageDb 注释查实）：
    // archived 是终态，「archived 终态只收 submit（自转移，history 追加当 audit）」——
    // act ok:true 但 flowStatus 不变，行**永不离开**归档列表（三前端共用 :5201 同款语义，
    // brief 骨架的「行离开」对 F08 不可成立）。改锚真可观察行为：act 被接受（200 且逐条
    // ok:true）+ 行留存阶段列表（自转移语义，反向区分于 F05-F07 前移，非恒真）。
    if (phase.f === "F08") {
      const actResp = page.waitForResponse(
        (r) => /\/api\/receipts\/archived\/act/.test(r.url()) && r.request().method() === "POST",
        { timeout: 15_000 },
      );
      await actFirstRow(page, phase);
      const resp = await actResp;
      expect(resp.status(), "归档 act 应 200").toBe(200);
      const results = (await resp.json()) as Array<{ id: string; ok: boolean }>;
      expect(
        results.length > 0 && results.every((r) => r.ok),
        `归档 act 应逐条 ok：${JSON.stringify(results).slice(0, 200)}`,
      ).toBe(true);
      await expect(textRow(page, code).first()).toBeVisible({ timeout: 15_000 });
      return;
    }
    await actFirstRow(page, phase);
    // act 后 refetch：code 不再出现在该阶段表格（superset 最弱共同断言；反馈机制三端不同不入断言）
    await expect(table).not.toContainText(code, { timeout: 15_000 });
  });
}
