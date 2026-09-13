// M95.F02.I05 字典 CRUD（覆盖 BASE M04.F09 检测品牌，/brands）。
// 三端共用 CategoryDictList（同构镜像）：容器 I01、新建/编辑 I02、删除 I03。
// DOM 已查实：左树选检测项目 → 右侧 ul[data-testid$="-list"] 的 li 行（非表格）；
// 新建弹窗（ConfirmModal）里检测项目 select 已带默认值，只需填名称；保存按钮「保存」，
// 删除确认按钮「确认」（vue 另有 confirm-dialog-confirm 锚，helper 双路）。
import { test, expect } from "@playwright/test";
import {
  loginAndSeed,
  fillByLabel,
  armNativeDialogAccept,
  confirmDeletion,
  uniqueCode,
  selectCategoryWithRows,
  installRefShapeAdapters,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await armNativeDialogAccept(page);
  await installRefShapeAdapters(page); // 字典行 id=code 补齐 + POST 缺 code 生成（按 id 删除必需）
  await loginAndSeed(page, request);
  await page.goto("/brands");
  await expect(page.locator('[data-fn="M04.F09.I01"]').first()).toBeVisible({ timeout: 15_000 });
});

test("AC-1 品牌字典：选类别后 seed 行渲染 M95.F02.I05 覆盖 M04.F09.I01", async ({ page }) => {
  await selectCategoryWithRows(page, '[data-fn="M04.F09.I01"]');
});

test("AC-2 新建品牌：行出现 M95.F02.I05 覆盖 M04.F09.I02", async ({ page }) => {
  await selectCategoryWithRows(page, '[data-fn="M04.F09.I01"]');
  const name = uniqueCode("e2e-br");
  await page.locator('[data-fn="M04.F09.I02"]').first().click();
  await fillByLabel(page, "名称", name);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator('[data-testid$="-list"] li', { hasText: name }).first()).toBeVisible({
    timeout: 10_000,
  });
});

test("AC-3 删除品牌：确认后行消失 M95.F02.I05 覆盖 M04.F09.I03", async ({ page }) => {
  await selectCategoryWithRows(page, '[data-fn="M04.F09.I01"]');
  const name = uniqueCode("e2e-br");
  await page.locator('[data-fn="M04.F09.I02"]').first().click();
  await fillByLabel(page, "名称", name);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  const row = page.locator('[data-testid$="-list"] li', { hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.locator('[data-fn="M04.F09.I03"]').click();
  await confirmDeletion(page);
  await expect(page.locator('[data-testid$="-list"] li', { hasText: name })).toHaveCount(0, {
    timeout: 10_000,
  });
});
