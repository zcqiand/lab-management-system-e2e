// M95.F02.I01 登录主流程（lab 版：SSO orchestrator，非密码表单）。
// lab 三前端 /login 是 OAuth 2.0 授权码 orchestrator（RFC 6749，镜像 nextjs 模型）：
//   阶段 2：无回调参数 → GET /auth/sso/authorize（response_type/client_id/redirect_uri/state）
//           → window.location 跳 saas 身份平台
//   阶段 1：?code=&state= 回跳 → 验 state（防 CSRF）→ POST /auth/sso/callback 换 lab JWT
// saas 侧 IdP 的行为已由 saas-e2e 全链覆盖；本 spec 只测 lab 浏览器侧职责，
// saas 跳转目标与 callback 响应用 page.route 虚拟化（无需 saas 家族在场）。
// 覆盖 BASE M01.F05（认证管理）浏览器侧。
import { test, expect } from "@playwright/test";
import { uniqueCode } from "./helpers";

// 虚拟 saas authorize 落点：不在本机监听，route fulfill 让导航可完成
const SAAS_AUTHORIZE = "http://saas-e2e-virtual.test/authorize";

test.beforeEach(async ({ page }) => {
  // 阶段 2 的 authorize：后端返 authorizeUrl → 前端 window.location 跳过去。
  // 虚拟 RP 同款手法（saas oauth-jump AC-1）：fulfill 让导航完成、断言最终 URL。
  await page.route("**/auth/sso/authorize**", async (route) => {
    const req = new URL(route.request().url());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        authorizeUrl: `${SAAS_AUTHORIZE}?rt=code&cid=${req.searchParams.get("client_id") ?? ""}&ru=${encodeURIComponent(req.searchParams.get("redirect_uri") ?? "")}&st=${req.searchParams.get("state") ?? ""}`,
      }),
    });
  });
  await page.route(`${SAAS_AUTHORIZE}**`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<html>virtual saas authorize</html>" }),
  );
});

test("AC-1 未登录访问 /login 自动发起 SSO：authorize 参数完整且浏览器真实跳转 M95.F02.I01 覆盖 M01.F05.I01", async ({ page }) => {
  await page.goto("/login");
  // 前端调后端 authorize → 拿 authorizeUrl → 真实跳转 saas 落点
  await page.waitForURL(new RegExp(`^${SAAS_AUTHORIZE}`), { timeout: 20_000 });
  const finalUrl = new URL(page.url());
  // RFC 6749 §4.1.1：response_type=code、client_id 非空、state 非空（防 CSRF）、redirect_uri 裸 /login
  expect(finalUrl.searchParams.get("rt")).toBe("code");
  expect(finalUrl.searchParams.get("cid"), "client_id 非空（契约必填）").toBeTruthy();
  expect(finalUrl.searchParams.get("st"), "state 非空（CSRF 防护）").toBeTruthy();
  expect(new URL(finalUrl.searchParams.get("ru")!).pathname).toBe("/login");
});

test("AC-2 回跳 state 校验失败：不发 callback、停留 /login 显示错误 M95.F02.I01 覆盖 M01.F05.I01", async ({ page }) => {
  let callbackCalled = false;
  await page.route("**/auth/sso/callback**", (route) => {
    callbackCalled = true;
    return route.fulfill({ status: 400, contentType: "application/json", body: "{}" });
  });
  // 直接带 code 回跳：本 context 从未走过阶段 1，sessionStorage 无 state 可匹配
  // → 必须 401 语义拒绝（session 过期/被攻击同路径），不得发 callback
  await page.goto("/login?code=e2e-code&state=st-tampered");
  await expect(page.getByText(/state 校验失败/).first()).toBeVisible({ timeout: 10_000 });
  expect(callbackCalled, "state 不匹配不得发起 callback（防 CSRF 核心断言）").toBe(false);
});

test("AC-3 回跳 state 匹配：callback 换 token、lab JWT 落 localStorage 并离开登录页 M95.F02.I01 覆盖 M01.F05.I01", async ({ page }) => {
  const code = uniqueCode("e2e-code");
  // 捕获阶段 1 authorize 请求里应用自己生成的 state（sessionStorage 属 app 域，
  // 测试不能跨 origin 代写——AC 教训：虚拟 saas 页上 setItem 写的是别的 origin）
  let capturedState = "";
  await page.route("**/auth/sso/authorize**", async (route) => {
    capturedState = new URL(route.request().url()).searchParams.get("state") ?? "";
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ authorizeUrl: `${SAAS_AUTHORIZE}?st=${capturedState}` }),
    });
  });
  await page.route("**/auth/sso/callback**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        token: "e2e-fake-lab-jwt",
        refreshToken: "e2e-fake-lab-rt",
        user: { id: "USER-E2E", username: "alice", displayName: "E2E", roleCode: "admin" },
        tenants: [
          { tenantId: "TENANT-001", code: "city-lab", name: "市住建工程质量检测中心", roleIds: ["admin"] },
        ],
      }),
    }),
  );
  await page.goto("/login");
  await page.waitForURL(new RegExp(`^${SAAS_AUTHORIZE}`), { timeout: 20_000 });
  expect(capturedState, "authorize 请求必须携带 state（RFC 6749）").toBeTruthy();

  // 模拟 saas 原样回跳（裸 /login + code + state）→ state 校验通过 → 换 token
  await page.goto(`/login?code=${code}&state=${capturedState}`);

  // 换到的 lab JWT 落各端自己的 storage key（spec 不分叉：superset 断言，任一 key 命中即过）
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => window.localStorage.getItem("lab.accessToken") ?? window.localStorage.getItem("lab.token"),
        ),
      { timeout: 15_000 },
    )
    .toBe("e2e-fake-lab-jwt");
});
