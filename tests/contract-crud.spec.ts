// M95.F02.I02 合同管理 CRUD（覆盖 BASE M02.F01 列表/创建/编辑/删除）。
// 三端公共锚（已查实同构）：tr[data-fn=M02.F01.I01] 行容器、M02.F01.I02 新建/保存、
// M02.F01.I03 行内删除、确认语「确认删除合同 <code>」、toast/行出现可观察行为。
// 写操作自产自销：每个用例先建自己的行，删/改互不依赖执行顺序。
import { test, expect } from "@playwright/test";
import {
  loginAndSeed,
  fillByLabel,
  armNativeDialogAccept,
  confirmDeletion,
  uniqueCode,
  fnRow,
  textRow,
  formDialog,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await armNativeDialogAccept(page); // nextjs 原生 confirm（已登记分歧）
  await loginAndSeed(page, request);
  await page.goto("/contracts");
  await expect(page.getByText("合同管理").first()).toBeVisible({ timeout: 15_000 });
});

test("AC-1 合同列表渲染 seed 行 M95.F02.I02 覆盖 M02.F01.I01", async ({ page }) => {
  const rows = fnRow(page, "M02.F01.I01");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  expect(await rows.count()).toBeGreaterThan(0);
});

async function createContract(page: import("@playwright/test").Page, code: string): Promise<void> {
  await page.locator('[data-fn="M02.F01.I02"]').first().click();
  const dialog = formDialog(page); // nextjs 弹窗无 role=dialog（已登记分歧）
  await expect(dialog.first()).toBeVisible();
  // 六必填字段（三端 label 全等，已查实）：合同编号/委托单位/项目名称/施工单位/见证单位/见证人
  await fillByLabel(dialog, "合同编号 *", code);
  await fillByLabel(dialog, "委托单位 *", "E2E 委托单位");
  await fillByLabel(dialog, "项目名称 *", "E2E 项目");
  await fillByLabel(dialog, "施工单位 *", "E2E 施工单位");
  await fillByLabel(dialog, "见证单位 *", "E2E 见证单位");
  await fillByLabel(dialog, "见证人 *", "E2E 见证人");
  // 保存锚分歧（已登记）：react/vue 保存钮 = I02；nextjs = I03 且新建态文案「创建」。
  // superset：data-fn 双锚 + 可观察文案，三端各命中同一元素
  await dialog
    .locator('[data-fn="M02.F01.I02"], [data-fn="M02.F01.I03"]')
    .or(dialog.getByRole("button", { name: /保存|创建/ }))
    .first()
    .click();
  await expect(dialog.first()).not.toBeVisible({ timeout: 10_000 });
  await expect(textRow(page, code).first()).toBeVisible({ timeout: 10_000 });
}

test("AC-2 创建合同：行出现 M95.F02.I02 覆盖 M02.F01.I02", async ({ page }) => {
  const code = uniqueCode("e2e-ct");
  await createContract(page, code);
});

test("AC-3 编辑合同：项目名称变更落行 M95.F02.I02 覆盖 M02.F01.I02", async ({ page }) => {
  const code = uniqueCode("e2e-ct");
  await createContract(page, code);
  const row = textRow(page, code).first();
  await row.getByRole("button", { name: "编辑" }).click();
  const dialog = formDialog(page); // nextjs 弹窗无 role=dialog（已登记分歧）
  await expect(dialog.first()).toBeVisible();
  await fillByLabel(dialog, "项目名称 *", "E2E 项目（改）");
  await dialog
    .locator('[data-fn="M02.F01.I02"], [data-fn="M02.F01.I03"]')
    .or(dialog.getByRole("button", { name: /保存|创建/ }))
    .first()
    .click();
  await expect(dialog.first()).not.toBeVisible({ timeout: 10_000 });
  await expect(textRow(page, "E2E 项目（改）").first()).toBeVisible({ timeout: 10_000 });
});

test("AC-4 删除合同：确认后行消失 M95.F02.I02 覆盖 M02.F01.I03", async ({ page }) => {
  const code = uniqueCode("e2e-ct");
  await createContract(page, code);
  const row = textRow(page, code).first();
  // 行内删除锚分歧（已登记）：react/vue = I03；nextjs 行内按钮无 data-fn → 文案兜底
  await row
    .locator('[data-fn="M02.F01.I03"]')
    .or(row.getByRole("button", { name: "删除", exact: true }))
    .first()
    .click();
  await confirmDeletion(page);
  await expect(textRow(page, code)).toHaveCount(0, { timeout: 10_000 });
});
