# 微信小程序 E2E 调试记录

## 背景

项目初次引入 `miniprogram-automator` 做端到端测试时，一直无法与微信开发者工具建立连接，使用 `npm run test:e2e` 会报 `Failed connecting to ws://127.0.0.1:PORT` 或 `Failed to launch wechat web devTools`。

## 排查与操作步骤

1. **确认 CLI 路径与版本**
   - 通过 `where cli.bat`、`Get-ChildItem` 等命令定位到 `C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat`。
   - 手动执行 `"C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" auto --project <项目路径> --auto-port 9421` 验证 CLI 是否能启动项目。

2. **启用自动化相关开关**
   - 在微信开发者工具设置 → 安全，勾选：
     - `服务端口`（记录实际端口，例如 61877/9421）。
     - `允许获取工具登录票据`。
     - `自动化接口打开工具时默认信任项目`。
   - 初次启动时，IDE 弹出“是否允许自动化测试”的提示，务必点击允许。

3. **使用 `automator.connect` 流程**
   - `tests/e2e/config/devtools.js` 读取 `WX_DEVTOOLS_WS` 环境变量，默认端口 9421。
   - 测试前手动运行 CLI 打开项目，并读取控制台输出的实际端口；若为 61877，则执行 `set WX_DEVTOOLS_WS=ws://127.0.0.1:61877` 再运行 `npm run test:e2e`。

4. **增强测试稳定性**
   - `tests/e2e/specs/home.spec.js` 新增 `waitForElement` 助手，轮询页面元素，避免云函数返回较慢导致 `null`。
   - 首页示例页 `miniprogram/pages/index/index.js` 在捕获云函数异常时写入 `cloudResult` 文案，便于断言失败信息。

5. **成功标志**
   - 终端输出 `PASS tests/e2e/specs/home.spec.js`，耗时约 9~10 秒。
   - 微信开发者工具自动化端口保持开启，测试执行完毕会断开连接。

## 常用命令

```powershell
# 启动带自动化端口的 IDE
"C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" auto --project "C:\Users\86152\work\test01" --auto-port 9421

# 执行 E2E 测试（端口与自动化通知一致时使用）
set WX_DEVTOOLS_WS=ws://127.0.0.1:9421
npm run test:e2e
```

## 经验总结

- 自动化接口一定要使用 CLI 打开项目，手动启动的窗口不会开放 WebSocket。
- IDE 会根据占用情况调整端口（例如 9421 → 61877），以 CLI 输出为准，并同步到 `WX_DEVTOOLS_WS`。
- 如遇连接失败，优先检查设置是否勾选、是否同帐号登录，以及 CLI 控制台是否有 “自动化已开启” 提示。
- 当页面依赖云函数返回时，测试应主动轮询 UI 或增加延时，确保断言可靠。
