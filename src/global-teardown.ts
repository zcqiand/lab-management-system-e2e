// 跑测结束后把 msw fixtures 还原到启动快照：
// e2e 自产自销的行（如 e2e-xxx 接样单）即使断言失败/重试泄漏，也不会残留在
// 开发者的 msw 内存里污染手动浏览。与 globalSetup 的 reset 成对。
//
// 用 node:http 而非 fetch（undici）：Windows 下 undici 的 keep-alive 句柄
// 会在进程退出时触发 libuv 断言崩溃（exit 127），污染 playwright 退出码。
import http from "node:http";

export default async function globalTeardown(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = http.request(
      { host: "localhost", port: 5200, path: "/api/v1/__e2e/reset", method: "POST" },
      (res) => {
        res.resume();
        res.on("end", resolve);
      },
    );
    req.on("error", () => resolve()); // msw 没起：setup 已报过更明确的错
    req.end();
  });
}
