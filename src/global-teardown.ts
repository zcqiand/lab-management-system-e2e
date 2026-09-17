// 跑测结束后把种子行还原（shared seed-db upsert 重灌）：写路径用例翻转过的
// seed 行（如 flowStatus）、断言失败/重试泄漏的行，不会残留污染开发者手动
// 浏览被测库。与 globalSetup 的 reseed 成对（2026-09-17 起 reset 语义从 msw
// 内存快照改为 DB upsert；自产行靠唯一 code，不依赖删除式清理）。
import { reseed } from "./global-setup";

export default async function globalTeardown(): Promise<void> {
  try {
    reseed();
  } catch {
    // setup 已报过更明确的错；teardown 失败不污染 playwright 退出码
  }
}
