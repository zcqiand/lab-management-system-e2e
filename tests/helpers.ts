// E2E 公共流程助手。选择器只锚 data-fn 与可观察行为（ADR-0030 Decision 4）。
//
// lab 家族登录模型（与 saas 的本质差异）：三前端 /login 都是 SSO orchestrator，
// 没有密码表单；密码凭据只被 lab 后端 /api/auth/login 接受。因此本套件用
// **API 登录 + localStorage 预置**建立会话（三端 key 名不同——lab.accessToken /
// lab.refreshToken / lab.activeTenantId（react/vue）与 lab.token（nextjs）——
// spec 不分叉：全部预置，各端只读自己的 key，同 saas smoke-nav AC-4 先例）。
import { expect, type Page, type APIRequestContext, type Locator } from "@playwright/test";
import { requireE2eEnv } from "../src/env";

/** superset 行锚（ADR-0030：锚 data-fn 与可观察行为，不锚 DOM 标签）。
 *  2026-09-13 首轮联跑登记的行 DOM 分歧：react/nextjs = 真 `<tr data-fn>`；
 *  vue Table 原语 shadcn 迁移（Phase 2a-1）后行是 `div[role=row][data-fn]`
 *  （语义等价 <tr>，无 tr 元素）。表头行无 data-fn，不会混入。 */
export function fnRow(page: Page, fn: string): Locator {
  return page.locator(`tr[data-fn="${fn}"], [role="row"][data-fn="${fn}"]`);
}

/** superset 行文本定位（表头行不含业务文本，不会误配）。 */
export function textRow(page: Page, text: string): Locator {
  return page.locator('tr, [role="row"]', { hasText: text });
}

/** I01 锚承载分歧（2026-09-13 首轮联跑查实）：react/vue 行级 `tr/div[data-fn]`，
 *  nextjs（FlowStagePage 等）容器级 div[data-fn] + 行为无锚普通 tr。
 *  「容器内的行 ∪ 行自身」双路计数，三端统一 = 数据行数。 */
export function fnRows(page: Page, fn: string): Locator {
  return page.locator(
    `[data-fn="${fn}"] tr, [data-fn="${fn}"] [role="row"], tr[data-fn="${fn}"], [role="row"][data-fn="${fn}"]`,
  );
}

/** 登录响应（真 lab-nextjs /api/auth/login 返回形态的子集）。 */
export interface LabSession {
  token: string;
  refreshToken: string;
  currentTenantId: string;
}

/** API 登录（真 lab-nextjs :5201 /api/auth/login；saas 不可达时菜单快照写空，
 *  前端 useBackendMenus 回退静态菜单——与 msw 时期表现一致）。 */
export async function apiLogin(request: APIRequestContext): Promise<LabSession> {
  const base = requireE2eEnv("E2E_API_BASE_URL");
  const res = await request.post(`${base}/auth/login`, {
    data: {
      username: requireE2eEnv("E2E_TEST_USERNAME"),
      password: requireE2eEnv("E2E_TEST_PASSWORD"),
    },
  });
  expect(res.status(), "API 登录应 200（检查 E2E_TEST_USERNAME/PASSWORD 与 lab-nextjs :5201）").toBe(200);
  const body = (await res.json()) as { token: string; refreshToken: string };
  const me = await request.get(`${base}/auth/me`, {
    headers: { authorization: `Bearer ${body.token}` },
  });
  expect(me.status(), "登录后 /auth/me 应 200").toBe(200);
  const meBody = (await me.json()) as { currentTenantId: string };
  return {
    token: body.token,
    refreshToken: body.refreshToken,
    currentTenantId: meBody.currentTenantId,
  };
}

/** 预置三端各自的会话 key（spec 不分叉：全部写入，各端只读自己的）。 */
export function seedSession(page: Page, session: LabSession): void {
  void page.addInitScript(
    ({ token, refreshToken, tenantId }) => {
      // 一次性播种：本 page 后续导航（登出跳 /login 等）init 脚本会再次执行，
      // 无条件种回会把登出刚清掉的 token 重新污染进 context 共享 storage，
      // fresh-page 验证被冲掉（probe5/6 实证，曾经被误诊为 msw SSO 自动重登）。
      // sessionStorage 旗标按 page 存活、跨导航保留、跨 page 天然隔离，
      // 正好做「本 page 只播一次」的闸。
      if (window.sessionStorage.getItem("__e2eSeeded") === "1") return;
      window.sessionStorage.setItem("__e2eSeeded", "1");
      window.localStorage.setItem("lab.accessToken", token); // react/vue
      window.localStorage.setItem("lab.refreshToken", refreshToken); // react/vue
      window.localStorage.setItem("lab.activeTenantId", tenantId); // react/vue
      window.localStorage.setItem("lab.token", token); // nextjs
    },
    { token: session.token, refreshToken: session.refreshToken, tenantId: session.currentTenantId },
  );
}

/** 组合：API 登录 + 会话预置。beforeEach 里对每个新 page 调用。 */
export async function loginAndSeed(page: Page, request: APIRequestContext): Promise<LabSession> {
  const session = await apiLogin(request);
  await seedSession(page, session);
  return session;
}

/** 按表单 label 文本填 input：优先 htmlFor/id 关联（getByLabel），
 *  兜底「label 兄弟节点 input」（家族 Field 组件 = div>Label+Input 无 id）。 */
export async function fillByLabel(
  scope: Page | import("@playwright/test").Locator,
  label: string,
  value: string,
): Promise<void> {
  const byId = scope.getByLabel(label, { exact: true });
  if ((await byId.count()) > 0) {
    await byId.first().fill(value);
    return;
  }
  const labelEl = scope.getByText(label, { exact: true }).first();
  await labelEl.locator("xpath=following-sibling::input[1]").fill(value);
}

/** nextjs 删除走原生 window.confirm（已登记分歧）——预挂自动 accept，
 *  react/vue 不触发原生 dialog，此监听为无害 no-op。 */
export function armNativeDialogAccept(page: Page): void {
  page.on("dialog", (d) => void d.accept());
}

/** 点掉删除确认：vue ConfirmDialog（data-fn 锚）vs react ConfirmModal（「确认」按钮）
 *  vs nextjs 原生 confirm（无 DOM，见 armNativeDialogAccept）。
 *  已登记分歧（待裁决收敛后可收敛本 helper），非 per-端 spec 分叉。 */
export async function confirmDeletion(page: Page): Promise<void> {
  const btn = page
    .locator('[data-fn="confirm-dialog-confirm"]')
    .or(page.getByRole("button", { name: "确认", exact: true }));
  try {
    await btn.first().click({ timeout: 3000 });
  } catch {
    // 原生 confirm 路径：已被 armNativeDialogAccept 吸收，无 DOM 可点
  }
}

/** 按表单 label 选中下拉第一项：原生 <select>（selectOption）与 radix Select
 *  （点触发器 + 点 listbox 首个 option，portal 在 body 上——scope 外，需 page）
 *  双路 superset，spec 不分叉。 */
export async function pickFirstOption(
  page: Page,
  scope: Page | import("@playwright/test").Locator,
  label: string,
): Promise<void> {
  const labelEl = scope.getByText(label, { exact: true }).first();
  const native = labelEl.locator("xpath=following-sibling::select[1]");
  if ((await native.count()) > 0) {
    await native.selectOption({ index: 1 }); // index 0 通常是「请选择」占位
    return;
  }
  // radix：触发器是 label 的下一个兄弟（button/combobox），选项列表 teleport 到 body
  await labelEl.locator("xpath=following-sibling::*[1]").click();
  await page.getByRole("option").first().click();
}

/** 本测试内唯一的业务 code（DB 有持久化——撞 seed/前次唯一约束的风险靠唯一 code 根除）。 */
export function uniqueCode(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 表单弹窗容器 superset：react/vue radix Dialog（role=dialog）vs
 *  nextjs ConfirmModal/ReceiptFormModal 的 div.fixed.inset-0（无 role，已登记分歧）。
 *  断言可见性时取 .first()。 */
export function formDialog(page: Page): import("@playwright/test").Locator {
  return page.locator('[role="dialog"]').or(page.locator("div.fixed.inset-0"));
}

/** 按 label 填 input，仅当本端存在该字段时（已登记分歧：委托书表单字段集
 *  react/vue 7 字段 vs nextjs ~23 字段——spec 只保证公共必填，端特有字段存在才填，
 *  同一代码路径三分端，非 per-端分支）。 */
export async function fillByLabelIfPresent(
  scope: Page | import("@playwright/test").Locator,
  label: string,
  value: string,
): Promise<void> {
  const byId = scope.getByLabel(label, { exact: true });
  if ((await byId.count()) > 0) {
    await byId.first().fill(value);
    return;
  }
  const labelEl = scope.getByText(label, { exact: true }).first();
  if ((await labelEl.count()) === 0) return;
  await labelEl.locator("xpath=following-sibling::input[1]").fill(value);
}

/** 按 label 选中下拉第一真实项：原生 <select>（selectOption，跳过占位 option）
 *  与 radix Select（点触发器 + 点首个非「未选择」option）按 tagName 双路 superset。
 *  label 定位优先 aria/htmlFor 关联，兜底「label 兄弟节点 select」（家族 Field 组件
 *  无 id 关联）。仅当本端存在该字段时执行（同 fillByLabelIfPresent 的分歧兜底）。 */
export async function pickFirstSelectOption(
  page: Page,
  scope: Page | import("@playwright/test").Locator,
  label: string,
): Promise<void> {
  let el = scope.getByLabel(label, { exact: true }).first();
  if ((await el.count()) === 0) {
    const labelEl = scope.getByText(label, { exact: true }).first();
    if ((await labelEl.count()) === 0) return;
    el = labelEl.locator("xpath=following-sibling::select[1]");
    if ((await el.count()) === 0) return;
  }
  const tag = await el.evaluate((n) => n.tagName.toLowerCase());
  if (tag === "select") {
    await el.selectOption({ index: 1 }); // index 0 通常是占位项
    return;
  }
  await el.click();
  await page
    .getByRole("option")
    .filter({ hasNotText: "未选择" })
    .first()
    .click();
}

/**
 * REF 形状适配（镜像 react 仓 tests/helpers/seed.ts installShapeAdapters，
 * nextjs 组件头注释同款声明）：shared 契约下列 GET 端点返回裸数组，三端 REF 页面
 * 一律读 {items,total}——桥接放测试缝，后端保持契约形状不动。
 *   - /api/technical-requirements：行 id 补成「obj/param/std」斜杠复合键——页面
 *     PUT/DELETE /technical-requirements/{id} 原样命中后端复合主键路由，无需改 URL；
 *   - /api/report-names：行 id 缺失补 id=code（nextjs 委托书表单报告名称下拉读 {items}）。
 */
export async function installRefShapeAdapters(page: Page): Promise<void> {
  const wrap = (route: import("@playwright/test").Route, mapRow: (r: Record<string, unknown>) => Record<string, unknown>) =>
    (async () => {
      try {
        const res = await route.fetch();
        const body = (await res.json()) as unknown;
        // 后端有的端点回裸数组（契约形状）、有的已回 {items,total}——两态都接
        const raw: Array<Record<string, unknown>> = Array.isArray(body)
          ? body
          : Array.isArray((body as { items?: unknown[] })?.items)
            ? ((body as { items: unknown[] }).items as Array<Record<string, unknown>>)
            : [];
        const items = raw.map(mapRow);
        await route.fulfill({
          status: res.status(),
          contentType: "application/json",
          body: JSON.stringify({ items, total: items.length }),
        });
      } catch {
        // 组件挂载即 abort 首个请求（StrictMode/组件 abort 语义）会把 route.fetch
        // 代理的响应 dispose，res.json() 抛「Response has been disposed」并把错误
        // 记到用例头上（2026-09-13 probe15 实证）。此处吞掉转 route.fallback()：
        // 该次请求原样透传，页面下轮 refetch 仍会走本 route 重桥形状。
        await route.fallback();
      }
    })();
  await page.route("**/api/technical-requirements?*", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return wrap(route, (r) => ({
      ...r,
      id: [
        r.inspectionObjectCode,
        r.inspectionParameterCode,
        r.judgmentStandardCode,
      ]
        .map((p) => encodeURIComponent(String(p ?? "")))
        .join("/"),
    }));
  });
  await page.route("**/api/report-names?*", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return wrap(route, (r) => ({ ...r, id: String(r.id ?? r.code ?? "") }));
  });
  // 4 类字典表（CategoryDictList 按 id 编辑/删除，契约按 code 寻址且行无 id）：
  //   GET：包 {items,total} + 补 id=code；POST：后端对缺 code 的 body 落 code=""
  //   （后续按 id 删除/拖拽排序必 404）→ 转发前补生成 code（镜像 react wrapDict 语义）。
  await page.route(/\/api\/catalog\/(brands|models|specs|grades)/, (route) => {
    const req = route.request();
    if (req.method() === "GET") {
      return wrap(route, (r) => ({ ...r, id: String(r.id ?? r.code ?? "") }));
    }
    if (req.method() === "POST") {
      const body = JSON.parse(req.postData() ?? "{}") as Record<string, unknown>;
      if (!body.code) body.code = `e2e-c-${Math.random().toString(36).slice(2, 10)}`;
      return route.continue({ postData: JSON.stringify(body) });
    }
    return route.fallback();
  });
}

/** 左树选出一个**有 seed 行**的类别并等行渲染（首个类别可能 0 行，如
 *  OBJ-SP01-P1 无品牌 seed——逐个点击直到行出现，端无关）。每次点击都等
 *  本轮 catalog GET 返回再判行，避免与上一轮请求竞态。 */
export async function selectCategoryWithRows(
  page: Page,
  container: string,
): Promise<void> {
  const buttons = page.locator(`${container} aside button`);
  // 树是异步渲染的：count() 快照在首帧常为 0（同 revealRows 坑，2026-09-13
  // probe14 nextjs 实证：763ms 秒挂=按钮 0 个直接抛「没有任何…seed 行」），
  // 先等首个按钮出现再计数
  await buttons.first().waitFor({ state: "visible", timeout: 10_000 });
  const total = await buttons.count();
  for (let i = 0; i < total; i++) {
    const respP = page
      .waitForResponse(
        (r) => r.request().method() === "GET" && /\/api\/catalog\//.test(r.url()),
        { timeout: 3000 },
      )
      .catch(() => null);
    await buttons.nth(i).click();
    await respP;
    try {
      await page
        .locator('[data-testid$="-list"] li')
        .first()
        .waitFor({ state: "visible", timeout: 2500 });
      return;
    } catch {
      // 该类别无种子数据，换下一个
    }
  }
  throw new Error("没有任何检测项目类别有 seed 行（检查 shared seeds 是否已灌入被测库）");
}
