// M95.F02.I05 字典 CRUD（覆盖 BASE M04.F09 检测品牌，/brands）。
// 三端共用 CategoryDictList（同构镜像）：容器 I01、新建 I02、编辑 I03(PUT)、删除 I04(DELETE)——2026-11-01 对齐功能树。
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

// AC 用例要完整开关弹窗两三轮（dev 编译下首个请求可达数秒，重载/冷路由更甚）——
// 全局 30s 预算在序列尾部必爆（2026-11-02 react techreq AC-3 Test timeout 实证：
// revealRows+createRow+两段 15s 断言 >30s）。data-entry.spec 同款先例，spec 局部
// 放宽，不动全局。
test.setTimeout(90_000);

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

test("AC-3 删除品牌：确认后行消失 M95.F02.I05 覆盖 M04.F09.I04", async ({ page }) => {
  await selectCategoryWithRows(page, '[data-fn="M04.F09.I01"]');
  const name = uniqueCode("e2e-br");
  await page.locator('[data-fn="M04.F09.I02"]').first().click();
  await fillByLabel(page, "名称", name);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  const row = page.locator('[data-testid$="-list"] li', { hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.locator('[data-fn="M04.F09.I04"]').click();
  await confirmDeletion(page);
  await expect(page.locator('[data-testid$="-list"] li', { hasText: name })).toHaveCount(0, {
    timeout: 10_000,
  });
});
