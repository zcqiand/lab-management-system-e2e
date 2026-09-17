// M95.F02.I06 技术要求 CRUD（覆盖 BASE M06.F06，/inspection-technical-requirements）。
// 已登记分歧（三种同源实现）：
//   - react/vue：平铺 <Table>（tbody tr），radix Select 表单（含「未选择」哨兵）；
//   - nextjs：TwoLevelObjectStandardTree 二级树（检测项目→检测标准，aside 按钮）+
//     ul[data-testid] li 拖拽行，ConfirmModal 原生 select 表单，删除走原生 confirm。
// 行数据形状差异由 installTechReqShapeAdapter 在测试缝桥接（后端保持契约裸数组）。
// spec 不分叉：superset 行定位 + 「字段存在才填」同一代码路径三分端。
import { test, expect, type Page } from "@playwright/test";
import {
  loginAndSeed,
  armNativeDialogAccept,
  confirmDeletion,
  uniqueCode,
  formDialog,
  pickFirstSelectOption,
  fillByLabel,
  fillByLabelIfPresent,
  installRefShapeAdapters,
} from "./helpers";

const CONTAINER = '[data-fn="M06.F06.I01"]';
/** superset 行：react 表格行 vs vue div[role=row]（shadcn 迁移后无 tr 元素，
 *  且行级不带 data-fn——仅容器 I01，已登记分歧）vs nextjs 树右列 li 行。
 *  「行内不含 columnheader」排除表头行（react/nextjs 表头在 thead，本就不配）。 */
const ROWS =
  'tbody tr, [role="row"]:not(:has([role="columnheader"])), [data-testid$="-list"] li';

test.beforeEach(async ({ page, request }) => {
  await armNativeDialogAccept(page);
  await installRefShapeAdapters(page);
  await loginAndSeed(page, request);
  await page.goto("/inspection-technical-requirements");
  await expect(page.locator(CONTAINER).first()).toBeVisible({ timeout: 15_000 });
});

/** nextjs 二级树需选检测项目→检测标准右列才出数据（react/vue 平铺表格无此步，
 *  aside 不存在时跳过）。返回的行定位器由调用方断言可见。 */
async function revealRows(page: Page): Promise<void> {
  const objBtn = page.locator(`${CONTAINER} aside button`).first();
  // 树是异步渲染的：count() 快照在首帧常为 0（2026-09-13 probe3 nextjs 实证：
  // 对象列表未回来时 count=0 直接跳过整块 → 行断言必红），waitFor 等它出现
  await objBtn.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {
    // react/vue 平铺表格无 aside（已登记分歧）
  });
  if ((await objBtn.count()) > 0) {
    await objBtn.click();
    // 二级标准节点同样异步（「加载中...」先渲染）
    const stdBtn = page.locator('[data-testid^="standard-"]').first();
    await stdBtn.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {
      // 无二级标准节点：行断言会按本端实际形态裁决
    });
    if ((await stdBtn.count()) > 0) await stdBtn.click();
  }
  await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 15_000 });
}

/** 打开新建弹窗并创建一条 brand 唯一的技术要求，返回该 brand（行定位用）。 */
async function createRow(page: Page, brand: string): Promise<void> {
  await page.locator('[data-fn="M06.F06.I02"]').first().click();
  const dialog = formDialog(page);
  await expect(dialog.first()).toBeVisible();
  // 复合主键两维（radix：react/vue；原生 select：nextjs）
  await pickFirstSelectOption(page, dialog, "检测项目");
  await pickFirstSelectOption(page, dialog, "检测参数");
  // 判定标准（复合主键第三维，值必须唯一）：三端共享一个有状态真后端，
  // 固定字面量或空串会让三个 project 建/删同一条 (obj,param,std) 行——跨 project
  // 互删、count 断言污染；空串还会让 DELETE URL 尾段为空不命中后端路由
  // （2026-09-13 probe3 vue AC-3 实证）。
  // nextjs 会预填当前树选中标准——**一律覆盖成唯一值**：预填值跨用例不变，
  // AC-2/AC-3 会建出同复合键的重复行，后端 insert 不去重，按复合键 DELETE 只删
  // 首条、自己的行残留（probe14 nextjs AC-3 实证）。「列表按 std 过滤所以必须
  // 保留预填」的前提在本仓测试缝上不成立：后端 GET 忽略 judgmentStandardCode
  // 过滤、adapter 原样包装，唯一 std 的新行照常可见。
  // 定位 superset：react Label htmlFor / nextjs aria-label → getByLabel；
  // vue Label 无 for 关联 → 「label 兄弟 input」兜底。
  let std = dialog.getByLabel("判定标准", { exact: true }).first();
  if ((await std.count()) === 0) {
    std = dialog
      .getByText("判定标准", { exact: true })
      .first()
      .locator("xpath=following-sibling::input[1]");
  }
  if ((await std.count()) > 0) {
    await std.fill(uniqueCode("e2e-std"));
  }
  await fillByLabelIfPresent(dialog, "牌号", brand);
  await fillByLabelIfPresent(dialog, "型号", "E2E-M");
  await fillByLabelIfPresent(dialog, "等级", "E2E-L1");
  await fillByLabelIfPresent(dialog, "规格", "E2E-SP");
  await dialog.getByRole("button", { name: "保存", exact: true }).first().click();
}

test("AC-1 技术要求列表渲染 seed 行 M95.F02.I06 覆盖 M06.F06.I01", async ({ page }) => {
  await revealRows(page);
});

test("AC-2 新建技术要求：保存成功、行数增长 M95.F02.I06 覆盖 M06.F06.I02", async ({ page }) => {
  await revealRows(page);
  const brand = uniqueCode("e2e-br");
  await createRow(page, brand);
  // 唯一 brand 定位新行（三端共享真后端串行跑，计数断言会被其他 project 的写入污染）
  await expect(page.locator(ROWS).filter({ hasText: brand }).first()).toBeVisible({
    timeout: 15_000,
  });
});

test("AC-3 删除技术要求：确认后行数回落 M95.F02.I06 覆盖 M06.F06.I03", async ({ page }) => {
  await revealRows(page);
  const brand = uniqueCode("e2e-br");
  await createRow(page, brand);
  const mine = page.locator(ROWS).filter({ hasText: brand }).first();
  await expect(mine).toBeVisible({ timeout: 15_000 });
  // 删掉刚建的那条（brand 全局唯一）：行内 I03，确认（原生 confirm 已预挂 accept）
  await mine.locator('[data-fn="M06.F06.I03"]').click();
  await confirmDeletion(page);
  await expect(page.locator(ROWS).filter({ hasText: brand })).toHaveCount(0, {
    timeout: 15_000,
  });
});
