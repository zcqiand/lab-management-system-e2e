// M95.F03.I01 — Playwright 结果 → .state/trace.json（suite 契约二）
// fnReporter 先例教训内置：
//  - 收完整个任务树再写文件（onEnd 一次性落盘，不靠增量回调）
//  - inert（skipped/todo/interrupted）测试 fns 必为空数组（声称覆盖却不执行 = 假绿）
//  - Map 去重：retries 的多次 onTestEnd 以最后一次为准
// 标题里的 fn ID 全收：M95.*（本仓基建）+ 覆盖的 BASE ID（如 M01.F04.I03）。
import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { mkdirSync, writeFileSync } from "node:fs";

const FN_RE = /\bM\d{2}\.F\d{2}\.I\d{2}\b/g;
// trace.fns 只收本仓命名空间 M95.*：L5 引用完整性只认本仓清单，BASE ID 会报悬空
// （suite base_ids 豁免目前仅 -contract-test 后缀仓；e2e 要进 BASE 覆盖矩阵维度
//  是 suite 扩展，待人裁决——同 saas-e2e 2026-09-10 结论）。
// BASE 覆盖保留在标题文本（跨仓路径扫描拾取，同 contract-test path refs 先例）。
const OWN_NS_RE = /^M95\./;

export default class TraceReporter implements Reporter {
  private readonly byKey = new Map<string, { test: string; fns: string[]; inert: boolean }>();

  onTestEnd(test: TestCase, result: TestResult): void {
    // Playwright status: passed | failed | timedOut | interrupted | skipped
    const inert = result.status === "skipped" || result.status === "interrupted";
    const fns = inert
      ? []
      : [...new Set(test.title.match(FN_RE) ?? [])].filter((f) =>
          OWN_NS_RE.test(f),
        );
    // 契约示例是仓相对路径（tests/xx.spec.ts::标题）；绝对路径换机器/CI 必漂移
    const cwd = process.cwd().replace(/\\/g, "/") + "/";
    const file = test.location.file.replace(/\\/g, "/").replace(cwd, "");
    this.byKey.set(`${file}::${test.title}`, {
      test: `${file}::${test.title}`,
      fns,
      inert,
    });
  }

  onEnd(_result: FullResult): void {
    mkdirSync(".state", { recursive: true });
    const payload = {
      schema: 1,
      tests: [...this.byKey.values()].sort((a, b) => a.test.localeCompare(b.test)),
    };
    writeFileSync(".state/trace.json", JSON.stringify(payload, null, 2) + "\n");
  }
}
