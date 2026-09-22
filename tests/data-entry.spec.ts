// M95.F02.I09 数据录入用例（覆盖 BASE M03.F03）。
// 已查实三端锚（2026-09-22 recon）：
//   - 列表行内「录入结果」：三端同 data-fn=M03.F03.I03（react/vue=features/data-entry，
//     nextjs=features/data-entry，页面壳均 /data-entry）；
//   - 弹窗「保存」：三端同 data-fn=M03.F03.I02；保存后收尾分歧（实测源码修正 recon）：
//     react/vue 保存成功后弹窗**自动关**（react onSaved→setEntryTarget(null) /
//     vue handleSave→entryTarget=null），nextjs saveAll 后弹窗停留、footer「关闭」收尾
//     ——closeDialogIfOpen 按「取消|关闭」按钮 superset，已关则跳过；
//   - 检测结果输入：DefaultParamCard「检测结果」Label + placeholder「录入检测结果」
//     ——三端镜像同构（三仓 DefaultParamCard 均有该 placeholder，2026-09-22 查实）；
//     若某端 placeholder 漂移，退化为 formDialog 内 placeholder*=检测 定位；
//   - 分歧登记（不入断言）：nextjs 弹窗内样品级 CRUD（M03.F03.I10/I11）为 nextjs 独有；
//     三态过滤器三端零实现；人工改判无独立锚。
// 断言全部唯一值基：三端共享 :5201 有状态后端，跨端残留由「先填后断自身唯一值」吸收。
import { test, expect, type Page } from "@playwright/test";
import {
  loginAndSeed,
  armNativeDialogAccept,
  uniqueCode,
  formDialog,
} from "./helpers";
import { requireE2eEnv } from "../src/env";

// AC-3/4 单用例要完整开关弹窗两三轮，每轮 EntryModal 并发拉 ~9 个域端点
// （parameters pageSize=1000 / standards 500 / report-names 500…，dev 编译下
// 单端点可达数秒）——config 默认 30s 不够，本文件放宽到 90s（spec 局部，不动全局）。
test.setTimeout(90_000);

/**
 * CORS 测试缝（2026-09-22 实证登记，e2e-runtime §3.6「后端保持不动，桥接放测试缝」同款）：
 * lab-nextjs 的 /api/* route handlers **没有 CORS 中间件**——家族白名单 env
 * `LAB_CORS_ALLOWED_ORIGINS` 只在 springboot/aspnetcore 落地（multi-repo-family §6
 * 不变量「每个后端 allowlist 必须含所有跨源前端 origin」，nextjs 漏网），
 * react/vue（:5202/:5203）跨源调 :5201 的响应全被浏览器拦（无 ACAO 头，preflight 204
 * 也不带）。本缝用 page.route 在 **Node 侧**代理 API 响应并补 CORS 头：
 *   - 同源请求（nextjs project 自身）origin 头缺失或等于 API origin → route.fallback
 *     原样放行，零干预；
 *   - preflight OPTIONS → fulfill 204 + ACAO/ACAC/ACAH；
 *   - 其余 → route.fetch（Node 无 CORS 概念，透传 Authorization/body）后补两个头 fulfill。
 * 后端补上 CORS 中间件后本缝可整体删除（届时同源分支已是 no-op，删除零风险）。
 */
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

/** 行内「录入结果」按钮锚：三端 data-fn=M03.F03.I03 都落在**按钮本身**
 *  （react/vue=td 内 Button、nextjs=FlowStagePage rowActions button）——
 *  不是行元素，helpers.fnRows 的「锚容器内行 ∪ 锚行自身」双路在此收不到
 *  （nextjs 列表容器 data-fn 是 I01，2026-09-22 nextjs 首跑实证）。 */
const rowAction = (page: Page) => page.locator('[data-fn="M03.F03.I03"]');

test.beforeEach(async ({ page, request }) => {
  await armNativeDialogAccept(page);
  await installCorsBridge(page); // react/vue 跨源调 :5201 被 CORS 拦——见 installCorsBridge 注释
  await loginAndSeed(page, request);
  await page.goto("/data-entry");
  // 列表 = 后端 flowStatus=data_entry 过滤（种子 33 行）；行锚三端同
  await expect(rowAction(page).first()).toBeVisible({ timeout: 15_000 });
});

/** 打开第一行「录入结果」弹窗，等样品/参数就位（样品下拉非空或 nextjs 样品卡出现）。 */
async function openEntryDialog(page: Page): Promise<import("@playwright/test").Locator> {
  await rowAction(page).first().click();
  const dialog = formDialog(page);
  await expect(dialog.first()).toBeVisible();
  return dialog;
}

/** 关闭可能残留的弹窗（已关则跳过）。
 *  react/vue 保存成功后自动关（无「取消|关闭」可点→跳过）；nextjs 弹窗停留，
 *  点 footer「关闭」。vue footer 的「取消」同名兜底。不断言不可见：react 弹窗
 *  X 钮是英文 sr-only「Close」，AC-2 残留随 page 生命周期消亡，无跨用例污染。
 *  注意不做 formDialog().first() 再取后代：radix 系（react/vue）overlay
 *  div.fixed.inset-0 与 content[role=dialog] 是兄弟，.first() 常命中 overlay，
 *  其后代为空（2026-09-22 react 首跑实证）——后代查询一律走 union locator 本体。 */
async function closeDialogIfOpen(page: Page): Promise<void> {
  const close = formDialog(page)
    .getByRole("button", { name: /取消|关闭/ })
    .last();
  if (await close.isVisible().catch(() => false)) await close.click();
}

/** 样品就位断言（三端 superset，按弹窗 DOM 形状分派，非 per-端 if——pickFirstSelectOption 先例）。
 *  决策规则第 1 条落地（recon「弹窗内出现 YP-2026- 可见文本」只对 nextjs 成立）。
 *  分派键 = [role=dialog] 有无（radix 系 vs nextjs 裸容器），不能按 select 有无——
 *  nextjs 弹窗自带原生 select（footer 改判 + 参数卡检测依据），按 select 分派会误入
 *  react 分支（2026-09-22 三 project 全跑实证）：
 *   - react（role=dialog + 原生 select）：关闭态 option 文本不可见 → 断选中项文本
 *     （toHaveText 不要求可见）；
 *   - vue（role=dialog + reka Select）：SelectValue 显所选样品号文本；不显则点开下拉
 *     断言 option 再 Escape；
 *   - nextjs（无 role 容器）：样品卡样品号文本常驻 → 直接可见断言。 */
async function assertSampleReady(page: Page, dialog: import("@playwright/test").Locator): Promise<void> {
  // 分派键 = 页面级 [role=dialog] 在位与否。不能写 dialog.locator('[role=dialog]')：
  // locator 链只匹配**后代**，radix content 自身就是 union 的首元素，作后代查询恒 0
  // （2026-09-22 react 假阴实证）。radix content 挂载晚于 overlay，给 3s 宽限。
  const roleDialog = page.locator('[role="dialog"]').first();
  const isRadix = await roleDialog
    .waitFor({ state: "visible", timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (!isRadix) {
    // nextjs 裸容器：样品卡样品号文本常驻
    await expect(dialog.getByText(/YP-2026-/).first()).toBeVisible({ timeout: 15_000 });
    return;
  }
  const nativeSelect = roleDialog.locator("select").first();
  if ((await nativeSelect.count()) > 0) {
    // react 原生 <select>：关闭态 option 文本不可见 → 断选中项文本（toHaveText 不要求可见）
    await expect(nativeSelect.locator("option:checked").first()).toHaveText(/YP-2026-/, {
      timeout: 15_000,
    });
    return;
  }
  // vue reka Select：SelectValue 显所选样品号文本；不显则点开下拉断言 option 再 Escape
  const code = roleDialog.getByText(/YP-2026-/).first();
  if (await code.isVisible().catch(() => false)) {
    await expect(code).toBeVisible();
    return;
  }
  await roleDialog.getByRole("combobox").first().click();
  await expect(
    page.getByRole("option").filter({ hasText: /YP-2026-/ }).first(),
  ).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
}

/** 点「保存」并等保存请求落地（POST=create / PUT=update 双语义）。
 *  就绪信号 = test-records 写请求响应（决策规则第 3 条择稳）：response 返回即持久化完成，
 *  三端同语义。brief 骨架的「按钮回落 enabled」只保留给不关弹窗的 nextjs 也不可靠——
 *  react/vue 保存成功即卸载弹窗（onSaved→setEntryTarget(null)），按钮先没了，
 *  toBeEnabled 必假红，故删。保存按钮同 closeDialogIfOpen 的坑：走 union locator 后代。 */
async function saveAndWait(page: Page, dialog: import("@playwright/test").Locator): Promise<void> {
  const saved = page.waitForResponse(
    (r) =>
      /\/api\/test-records/.test(r.url()) &&
      ["POST", "PUT"].includes(r.request().method()),
    { timeout: 15_000 },
  );
  await dialog.locator('[data-fn="M03.F03.I02"]').first().click();
  await saved;
}

/** 检测结果输入（DefaultParamCard）：union locator 后代，两端 overlay 不挡。 */
function resultInput(dialog: import("@playwright/test").Locator): import("@playwright/test").Locator {
  return dialog.locator('[placeholder="录入检测结果"]').first();
}

test("AC-1 数据录入列表渲染 data_entry 种子行 M95.F02.I09 覆盖 M03.F03.I01/I06", async ({ page }) => {
  await expect(rowAction(page)).not.toHaveCount(0);
});

test("AC-2 录入弹窗打开：样品与检测参数就位 M95.F02.I09 覆盖 M03.F03.I01", async ({ page }) => {
  const dialog = await openEntryDialog(page);
  await assertSampleReady(page, dialog);
  // 参数就位：检测结果输入出现即 DefaultParamCard 已渲染（三端同 placeholder）
  await expect(resultInput(dialog)).toBeVisible({ timeout: 15_000 });
  await closeDialogIfOpen(page);
});

test("AC-3 保存检测结果：唯一值持久（重开回读） M95.F02.I09 覆盖 M03.F03.I08", async ({ page }) => {
  const v1 = uniqueCode("E2EJL");
  const dialog = await openEntryDialog(page);
  await expect(resultInput(dialog)).toBeVisible({ timeout: 15_000 });
  await resultInput(dialog).fill(v1);
  await saveAndWait(page, dialog);
  await closeDialogIfOpen(page);
  // 重开回读：openEntry 重新拉 test-records，唯一值必须在
  const dialog2 = await openEntryDialog(page);
  await expect(resultInput(dialog2)).toHaveValue(v1, { timeout: 15_000 });
  await closeDialogIfOpen(page);
});

test("AC-4 再次保存：结果更新落定 M95.F02.I09 覆盖 M03.F03.I09", async ({ page }) => {
  const v1 = uniqueCode("E2EJL");
  const v2 = uniqueCode("E2EJL");
  // 首存（create）后 react/vue 弹窗自动关（recon 修正，见文件头）——三端统一
  // 「关掉重开再改值」，第二次保存命中既有记录走 update（PUT）双语义。
  const dialog1 = await openEntryDialog(page);
  await expect(resultInput(dialog1)).toBeVisible({ timeout: 15_000 });
  await resultInput(dialog1).fill(v1);
  await saveAndWait(page, dialog1);
  await closeDialogIfOpen(page);

  const dialog2 = await openEntryDialog(page);
  await expect(resultInput(dialog2)).toHaveValue(v1, { timeout: 15_000 });
  await resultInput(dialog2).fill(v2);
  await saveAndWait(page, dialog2);
  await closeDialogIfOpen(page);

  const dialog3 = await openEntryDialog(page);
  await expect(resultInput(dialog3)).toHaveValue(v2, { timeout: 15_000 });
  await closeDialogIfOpen(page);
});
