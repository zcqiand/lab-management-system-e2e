// E2E 运行时环境（fail-fast，禁默认值兜底 —— suite CLAUDE.md §2 / ADR-0019 精神）。
// 加载顺序：进程 env（已有值不覆盖）← .env.local ← .env。
// env 四份契约见 suite docs/conventions/env.md：example/test 进仓，local/production 私有。
import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

/** 读必填 env。缺失即 throw（fail-fast），绝不兜底 demo 字面量。 */
export function requireE2eEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `[e2e] 缺 env ${name}（fail-fast 不兜底）。复制 .env.example 为 .env.local 填真值，` +
        `或检查 CI 注入。契约见 .env.example 注释。`,
    );
  }
  return v;
}
