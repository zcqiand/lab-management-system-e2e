// M95.F02.I04 委托书（样品接收）CRUD（覆盖 BASE M03.F01）。
// 已查实三端锚差异（已登记分歧）：
//   - 新建按钮：三端同 data-fn=M03.F01.I02；
//   - 行：react/vue/nextjs 均有 I01（FlowStagePage 承载）；
//   - 行内编辑：react/vue 纯文本「编辑」无锚；nextjs=I03 —— superset 锚文本「编辑」；
//   - 行内删除：react/vue=I03、nextjs=I04 —— superset 锚文本「删除」；
//     （I04 在 react/vue 语义是「提交」，不能当删除锚）
//   - 弹窗保存：三端均无 data-fn，文本「保存」；
//   - 表单字段集：react/vue 7 字段 vs nextjs ~23 字段（必填：react/vue 7 项全填，
//     nextjs 委托书编号/所属合同/报告名称）——「字段存在才填」同一代码路径。
//   - 保存后行为：react/vue 弹窗关闭；nextjs 转编辑态不关 —— 断言只锚行出现，
//     收尾统一点「取消」关掉（已关则跳过）。
import { test, expect, type Page } from "@playwright/test";
import {
  loginAndSeed,
  fillByLabelIfPresent,
  pickFirstSelectOption,
  armNativeDialogAccept,
  confirmDeletion,
  uniqueCode,
  formDialog,
  installRefShapeAdapters,
  fnRows,
  textRow,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await armNativeDialogAccept(page);
  await installRefShapeAdapters(page); // nextjs 报告名称下拉读 /api/report-names {items}
  await loginAndSeed(page, request);
  await page.goto("/receipts");
  // I01 承载分歧（已登记）：react/vue 行级、nextjs 容器级——锚存在即可见
  await expect(page.locator('[data-fn="M03.F01.I01"]').first()).toBeVisible({ timeout: 15_000 });
});

/** 创建一条委托书：公共必填「委托书编号」+ 各端存在才补的字段；
 *  断言行出现；收尾点「取消」关闭可能残留的弹窗（nextjs 编辑态）。 */
async function createReceipt(page: Page, code: string): Promise<void> {
  await page.locator('[data-fn="M03.F01.I02"]').first().click();
  const dialog = formDialog(page);
  await expect(dialog.first()).toBeVisible();
  await fillByLabelIfPresent(dialog, "委托书编号 *", code);
  await fillByLabelIfPresent(dialog, "委托日期 *", "2026-09-13");
  await fillByLabelIfPresent(dialog, "工程名称 *", "E2E 工程");
  await fillByLabelIfPresent(dialog, "委托单位 *", "E2E 委托单位");
  await pickFirstSelectOption(page, dialog, "检测类别 *");
  await pickFirstSelectOption(page, dialog, "样品来源 *");
  await fillByLabelIfPresent(dialog, "报告类别编码 *", "E2E");
  // nextjs 特有必填：所属合同 / 报告名称（原生 select）
  await pickFirstSelectOption(page, dialog, "所属合同 *");
  await pickFirstSelectOption(page, dialog, "报告名称 *");
  await dialog.getByRole("button", { name: "保存", exact: true }).first().click();
  // 可观察行为：列表出现新行（三端一致；不锚弹窗关闭——nextjs 不关，已登记分歧）
  await expect(textRow(page, code).first()).toBeVisible({ timeout: 15_000 });
  await closeDialogIfOpen(page, dialog);
}

/** nextjs 保存后弹窗转编辑态不自动关（已登记分歧）：有「取消」就点掉。 */
async function closeDialogIfOpen(page: Page, dialog: import("@playwright/test").Locator): Promise<void> {
  const cancel = dialog.getByRole("button", { name: "取消", exact: true }).first();
  try {
    await cancel.click({ timeout: 1500 });
  } catch {
    // react/vue 已自动关闭，无「取消」可点
  }
  await expect(dialog.first()).not.toBeVisible({ timeout: 5000 });
}

test("AC-1 委托书列表渲染 seed 行 M95.F02.I04 覆盖 M03.F01.I01", async ({ page }) => {
  const rows = fnRows(page, "M03.F01.I01");
  expect(await rows.count()).toBeGreaterThan(0);
});

test("AC-2 创建委托书：行出现 M95.F02.I04 覆盖 M03.F01.I02", async ({ page }) => {
  await createReceipt(page, uniqueCode("e2e-rc"));
});

test("AC-3 编辑委托书：委托书编号变更落行 M95.F02.I04 覆盖 M03.F01.I03", async ({ page }) => {
  const code = uniqueCode("e2e-rc");
  await createReceipt(page, code);
  const newCode = uniqueCode("e2e-rc");
  const row = textRow(page, code).first();
  // superset 锚：react/vue 文本「编辑」，nextjs I03 同文本
  await row.getByRole("button", { name: "编辑", exact: true }).click();
  const dialog = formDialog(page);
  await expect(dialog.first()).toBeVisible();
  await fillByLabelIfPresent(dialog, "委托书编号 *", newCode);
  await dialog.getByRole("button", { name: "保存", exact: true }).first().click();
  await expect(textRow(page, newCode).first()).toBeVisible({ timeout: 15_000 });
  await closeDialogIfOpen(page, dialog);
});

test("AC-4 删除委托书：确认后行消失 M95.F02.I04 覆盖 M03.F01.I03", async ({ page }) => {
  const code = uniqueCode("e2e-rc");
  await createReceipt(page, code);
  const row = textRow(page, code).first();
  // superset 锚：react/vue I03=删除，nextjs I04=删除（I03=编辑，已登记分歧）
  await row.getByRole("button", { name: "删除", exact: true }).click();
  await confirmDeletion(page);
  await expect(textRow(page, code)).toHaveCount(0, { timeout: 15_000 });
});
