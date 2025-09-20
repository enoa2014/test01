# 微信小程序 E2E 调试记录

## 背景

项目初次引入 `miniprogram-automator` 做端到端测试时，一直无法与微信开发者工具建立连接，使用 `npm run test:e2e` 会报 `Failed connecting to ws://127.0.0.1:PORT` 或 `Failed to launch wechat web devTools`。

## 排查与操作步骤

1. **确认 CLI 路径与版本**
   - 通过 `where cli.bat`、`Get-ChildItem` 等命令定位到 `C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat`。
   - 手动执行 `"C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" auto --project <项目路径> --auto-port 9421` 验证 CLI 是否能启动项目，看到通知中心提示“自动化端口已开启”即表示指令成功。

2. **启用自动化相关开关**
   - 在微信开发者工具 设置 → 安全 中勾选：
     - `服务端口`（记录实际端口，例如 9421/61877）。
     - `允许获取工具登录票据`。
     - `自动化接口打开工具时默认信任项目`。
   - 初次启动时，IDE 弹出“是否允许自动化测试”的提示，务必点击允许。

3. **确认真实端口并同步环境变量**
   - 使用 `cli.bat auto --debug` 可在命令行输出看到 `IDE server started` 的 HTTP 端口，例如 `http://127.0.0.1:60964`，同时通知中心会显示自动化端口（如 9421）。
   - 若端口被占用，可先运行 `Stop-Process -Name WeChatAppEx -Force` 或 `cli.bat quit` 清理残留进程后再重启。
   - 将自动化端口写入环境变量：`set WX_DEVTOOLS_WS=ws://127.0.0.1:<自动化端口>`。

4. **验证 WebSocket 是否可连**
   - 使用简单脚本快速测试：

```powershell
node - <<'JS'
const WebSocket = require('ws');
const ws = new WebSocket(process.env.WX_DEVTOOLS_WS || 'ws://127.0.0.1:9421');
ws.on('open', () => { console.log('open'); ws.close(); });
ws.on('error', (err) => { console.error('error', err.message); process.exit(1); });
JS
```

   - 或直接运行 `node temp-connect.js`（脚本示例见下文）调用 `automator.connect`，若输出 `connected` 说明端口可用。

5. **执行 E2E 测试**
   - 运行 `npm run test:e2e`，使用 `tests/e2e/specs/home.spec.js` 中的 `waitForElements` 辅助方法等待云函数结果。
   - 终端输出 `PASS tests/e2e/specs/home.spec.js`（约 10~12 秒内完成）即视为成功。

## 常用命令

```powershell
# 启动带自动化端口的 IDE（如自动化端口想固定为 9421）
"C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" auto --project "C:\Users\86152\work\test01" --auto-port 9421

# 若需要自定义 HTTP 服务端口与自动化端口
"C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" auto --project "C:\Users\86152\work\test01" --port 9422 --auto-port 9421 --trust-project

# 设置测试使用的 WebSocket 端口并执行 E2E 测试
set WX_DEVTOOLS_WS=ws://127.0.0.1:9421
npm run test:e2e

# 清理可能残留的开发者工具进程（端口被占用时）
Stop-Process -Name WeChatAppEx -Force
```

### `automator.connect` 快速验证脚本

```javascript
const automator = require('miniprogram-automator');
const ws = process.env.WX_DEVTOOLS_WS || 'ws://127.0.0.1:9421';
(async () => {
  const miniProgram = await automator.connect({ wsEndpoint: ws });
  console.log('connected to', ws);
  await miniProgram.disconnect();
})();
```

## 经验总结

- 自动化接口一定要使用 CLI 打开项目，手动启动的窗口不会开放 WebSocket 接口。
- IDE 会根据占用情况调整端口（例如 9421 → 60964），以 CLI/通知中心输出为准，并同步到 `WX_DEVTOOLS_WS`。
- 若 `npm run test:e2e` 报连接失败，可按顺序：清理端口 → 重新运行 `cli.bat auto --debug` → 使用 `automator.connect` 脚本验证，再执行测试。
- 当页面依赖云函数返回时，测试已通过 `waitForElements` 轮询避免时序问题，如仍不稳定，可增加等待时间或检查云函数日志。
