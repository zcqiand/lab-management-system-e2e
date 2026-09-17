// M95.F02.I03 会话（lab 版）：API 登录 → 会话预置 → 业务页可达；登出清理回登录页。
// lab 是单租户（M00.F02 switch-tenant 是后端换发语义，三前端无切换器 UI——
// saas 版「切换租户」用例在 lab 无对应物，不移植，见 docs/requirements 登记）。
// 覆盖 BASE M00.F01（当前用户会话）+ M01.F05.I04/I05（登出）。
import { test, expect } from "@playwright/test";
import { loginAndSeed, fnRow } from "./helpers";

test("AC-1 会话预置后业务页可达：合同列表渲染 seed 行 M95.F02.I03 覆盖 M00.F01.I01", async ({ page, request }) => {
  await loginAndSeed(page, request);
  await page.goto("/contracts");
  await expect(page.getByText("合同管理").first()).toBeVisible({ timeout: 15_000 });
  // 主列表非空（seed 合同 ≥1 行）——直击死桩类假绿
  const rows = fnRow(page, "M02.F01.I01");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  expect(await rows.count()).toBeGreaterThan(0);
});

test("AC-2 登出：会话清理落回登录页 M95.F02.I03 覆盖 M01.F05.I04", async ({ page, request }) => {
  await loginAndSeed(page, request);
  await page.goto("/contracts");
  await expect(page.getByText("合同管理").first()).toBeVisible({ timeout: 15_000 });

  // 登出锚：react/nextjs data-testid=logout-button（data-fn 分别 I04/I05，已登记分歧）；
  // vue 仅 data-fn=M01.F05.I04。superset 选择器，三端各命中恰好一个元素。
  // 两 page 都要拦 SSO authorize（probe3/5/6/8/11 迭代实证，三个机制叠加）：
  //   1. seed 通道已改「本 page 只播一次」（helpers seedSession）——否则主 page
  //      登出跳 /login 时 init 脚本再次种回 token，污染 context 共享 storage；
  //   2. 登出后 /login 挂载即自动走 SSO roundtrip——msw 时期 IdP 跳板被全程虚拟化
  //      （authorize 直接回 code、callback 签真 JWT），**主 page 自己**就会把
  //      新 token 写回共享 storage，fresh page 直接 authenticated；
  //   3. fresh page 的 /login 同理也会自动重登。
  //     真实 IdP 下登出后不可能静默重登，abort = 模拟「无用户交互不发 code」
  //     （M95.F02.I01 已登记的 route 虚拟化先例）。
  await page.route(/\/api\/auth\/sso\/authorize/, (r) => r.abort());
  await page
    .locator('[data-testid="logout-button"], [data-fn="M01.F05.I04"]')
    .first()
    .click();
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  // 会话已清的可观察行为验证（不锚 storage key——各端登出只清自己的 key，
  // 跨端 key 断言属过度指定，2026-09-13 首轮联跑裁决改为行为断言）。
  // 必须换新 page：同 context 新 page 共享已清空的 localStorage 且无 init 脚本。
  const fresh = await page.context().newPage();
  await fresh.route(/\/api\/auth\/sso\/authorize/, (r) => r.abort());
  await fresh.goto("/contracts");
  await expect(fresh).toHaveURL(/\/login/, { timeout: 15_000 });
  await fresh.close();
});
