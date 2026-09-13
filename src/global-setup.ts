// M95.F04.I01 配套：跑测前做两件运行时准备——
//   1. msw fixtures 还原到启动快照（根除跨运行累积 flaky）；
//   2. nextjs dev 暖机（见 warmupNextjs 注释）。
// 被测服务都是外部起的独立进程（e2e-runtime.md §1），这里只发 HTTP 调用，不起服务。
// msw 地址 = 家族端口表固定 :5200（suite docs/conventions/multi-repo-family.md §6），不走 env。
import { requireE2eEnv } from "./env";

/** 单请求暖机超时：冷路由首次编译可达数十秒，给足；暖机失败只 warn 不炸
 *  （用例自身超时是兜底，这里失败大概率意味着服务没起，会在首用例显式红）。 */
const WARM_TIMEOUT_MS = 120_000;

/** 带 AbortController 超时的 fetch，任何异常（含超时）都吞掉返回 null——暖机尽力而为。 */
async function warmOnce(url: string): Promise<number | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), WARM_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ac.signal });
    // 任意状态码都算编译完成（401/404 也证明 route 已可响应）
    return res.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** nextjs dev 是惰性编译：冷路由首个请求会挂数十秒（2026-09-13 probe14 实证：
 *  dict-crud/receipt-crud 的 nextjs 用例撞 /api/catalog/brands、/api/auth/menus
 *  等冷路由，页面停在「菜单加载中…/暂无数据」空态，断言假红；串行 worker 也
 *  一样——不是并行负载，是编译本身慢）。smoke-nav 按字典序跑在后面，暖不了
 *  前面的用例，所以必须在 globalSetup 阶段把全量页面 + 高频 API 预热一遍。
 *  Promise.allSettled + warn-not-throw：暖机是优化不是前置条件。 */
async function warmupNextjs(): Promise<void> {
  const base = requireE2eEnv("E2E_NEXTJS_URL");
  // 页面：smoke-nav 的 ROUTES 全集 + 登录页 + 技术要求页
  const pages = [
    "/",
    "/login",
    "/contracts",
    "/receipts",
    "/brands",
    "/models",
    "/specifications",
    "/grades",
    "/inspection-technical-requirements",
    "/summary",
  ];
  // 高频 API：菜单/会话/字典/检测能力/REF 各域路由 handler（dev 下页面与 API 路由
  // 分开编译，页面暖了不代表 API 暖了）。任意响应都算编译完成。
  const apis = [
    "/api/health",
    "/api/auth/menus",
    "/api/auth/me",
    "/api/auth/permissions",
    "/api/inspection/objects",
    "/api/inspection/parameters",
    "/api/inspection/standards",
    "/api/inspection/specialties",
    "/api/catalog/brands",
    "/api/catalog/models",
    "/api/catalog/specs",
    "/api/catalog/grades",
    "/api/contracts",
    "/api/receipts",
    "/api/technical-requirements",
    "/api/calculation-methods",
    "/api/report-names",
    "/api/samples",
    "/api/test-records",
    "/api/summary",
  ];
  const results = await Promise.allSettled([
    ...pages.map((p) => warmOnce(`${base}${p}`)),
    ...apis.map((p) => warmOnce(`${base}${p}`)),
  ]);
  const failed = results.filter((r) => r.status === "fulfilled" && r.value === null).length;
  if (failed > 0) {
    console.warn(`[e2e globalSetup] nextjs 暖机 ${failed} 个端点未响应（服务没起？）——不阻塞，由用例显式裁决`);
  }
}

export default async function globalSetup(): Promise<void> {
  const resetUrl = "http://localhost:5200/api/v1/__e2e/reset";
  const res = await fetch(resetUrl, { method: "POST" }).catch((e: unknown) => {
    throw new Error(
      `[e2e globalSetup] msw reset 失败（${resetUrl}）：${String(e)}。` +
        `确认 lab-msw 在跑（:5200/healthz）；起服约定见 docs/conventions/e2e-runtime.md。`,
    );
  });
  if (!res.ok) {
    throw new Error(`[e2e globalSetup] msw reset 返回 ${res.status}`);
  }
  await warmupNextjs();
}
