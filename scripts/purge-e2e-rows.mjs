// e2e 自产残留行清场（HTTP 黑盒版，2026-11-02 清场义务机器化批）。
//
// 为什么走 HTTP 不直连 PG（ADR-0018 / contract-test cleanup-pg.ts 同款裁定）：
//   直连版（前身）用 E2E_DATABASE_URL 指库，但被测 :5201 的实际库由「起它的
//   那一方」决定（gate L4 注入 lab_test / 开发者手动 lab_dev）——两边 env 一旦
//   不同源，purge 清的是另一个库，自产行残留打爆种子断言（2026-11-02 实证：
//   lab_test 10 行 e2e-ct-* 残留 → lab-react/lab-django 种子级 total 断言连爆）。
//   走 :5201 API = 服务连哪个库就清哪个库，同源由架构保证而非 env 约定。
//
// 清理对象（与 seed-db upsert 的「不删非种子行」互补）：
//   receipts: commission_code 前缀 e2e-rc-
//   contracts: contract_code 前缀 e2e-ct- / e2e-probe-
//   先删 receipts（FK RESTRICT 指向 contracts）再删 contracts。
//
// 用法（env fail-fast 禁兜底）：
//   E2E_API_BASE_URL=http://localhost:5201/api \
//   E2E_TEST_USERNAME=alice E2E_TEST_PASSWORD=... \
//   node scripts/purge-e2e-rows.mjs

const base = process.env.E2E_API_BASE_URL;
const username = process.env.E2E_TEST_USERNAME;
const password = process.env.E2E_TEST_PASSWORD;
const missing = [
  ["E2E_API_BASE_URL", base],
  ["E2E_TEST_USERNAME", username],
  ["E2E_TEST_PASSWORD", password],
].filter(([, v]) => !v).map(([k]) => k);
if (missing.length > 0) {
  console.error(
    `[purge-e2e-rows] 缺 env ${missing.join(" / ")}（fail-fast 不兜底）。` +
      `该脚本由 e2e globalSetup 注入 .env.test 契约键调用；手动跑请自备。`,
  );
  process.exit(1);
}

const TOLERANT_DELETE = (s) => s === 200 || s === 204 || s === 404;

async function api(path, opts = {}, token) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  return res;
}

/** 列表取全量再按前缀删。list 不通（服务没起/路由没起）即 throw——
 *  globalSetup 语境下被测服务必须已健康，purge 失败=环境错误。 */
async function purgeResource({ listPath, codeField, prefixes, deletePath, token }) {
  const listRes = await api(`${listPath}?page=1&pageSize=500`, {}, token);
  if (listRes.status !== 200) {
    throw new Error(`GET ${listPath} → ${listRes.status}（被测服务未起或路由未编译）`);
  }
  const body = await listRes.json();
  const items = Array.isArray(body) ? body : (body.items ?? []);
  if (items.length >= 500) {
    console.warn(
      `[purge-e2e-rows] ${listPath} 返回满页 500 行——残留可能超出单页扫描面，建议先手清再跑`,
    );
  }
  let purged = 0;
  for (const row of items) {
    const code = String(row[codeField] ?? "");
    if (!prefixes.some((p) => code.startsWith(p))) continue;
    const id = String(row.id ?? "");
    if (!id) continue;
    const delRes = await api(deletePath.replace("{*}", id), { method: "DELETE" }, token);
    if (!TOLERANT_DELETE(delRes.status)) {
      // 409（引用保护/FK）等业务拒删 → warn 保留现场，不阻塞清场循环
      console.warn(`[purge-e2e-rows] DELETE ${deletePath} ${code} → ${delRes.status}`);
      continue;
    }
    purged += 1;
  }
  return purged;
}

const loginRes = await api("/auth/login", {
  method: "POST",
  body: JSON.stringify({ username, password }),
});
if (!loginRes.ok) {
  throw new Error(
    `POST /auth/login → ${loginRes.status}——凭据与被测服务不匹配（E2E_TEST_USERNAME/PASSWORD）`,
  );
}
const { token } = await loginRes.json();

// 先 receipts（FK RESTRICT 指向 contracts）再 contracts
const receipts = await purgeResource({
  listPath: "/receipts",
  codeField: "commissionCode",
  prefixes: ["e2e-rc-"],
  deletePath: "/receipts/{*}",
  token,
});
const contracts = await purgeResource({
  listPath: "/contracts",
  codeField: "contractCode",
  prefixes: ["e2e-ct-", "e2e-probe-"],
  deletePath: "/contracts/{*}",
  token,
});
console.log(`[purge-e2e-rows] purged receipts=${receipts} contracts=${contracts}`);
