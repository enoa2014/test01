# 微信小程序骨架

本仓库提供一个对接云开发的微信小程序基础框架，使用 `.env` 中的配置自动生成项目所需的 `project.config.json` 与环境变量文件。

## 快速开始

1. 安装依赖：`npm install`
2. 同步配置：`npm run sync-config`
3. 使用微信开发者工具导入仓库根目录，即可开始开发调试。

## 目录结构

```
miniprogram/           # 小程序前端代码
  app.js
  app.json
  app.wxss
  config/envList.js    # 由脚本自动生成的环境配置
  pages/
    index/             # 示例首页
cloudfunctions/        # 云函数目录
  envList.js           # 与前端共用的环境配置
  helloWorld/          # 示例云函数
scripts/
  sync-config.js       # 同步 .env 的工具脚本
  fix-encoding.js      # 将文件重写为 UTF-8 无 BOM

tests/
  e2e/
    config/            # 端到端测试配置
    specs/             # Jest 测试用例
    jest.config.cjs    # Jest 配置文件
```

## 常用命令

- `npm run sync-config`：根据 `.env` 同步 `project.config.json` 及环境配置文件。
- `npm run fix-encoding`：遍历 `miniprogram/` 和 `cloudfunctions/`，将 JSON/WXML/WXSS/JS 文件统一写成 UTF-8 无 BOM。
- `npm run test:e2e:patients`：生成测试患者数据、执行端到端测试并在结束后自动清理。
- `npm run test:e2e` 或 `npm test`：执行端到端测试套件（自动启动微信开发者工具 CLI）。

## 端到端测试

1. **准备微信开发者工具 CLI**  
   - 打开微信开发者工具 → 设置 → 通用设置，勾选「允许命令行控制」；在安全设置中勾选「允许自动化测试」。
   - 记录 CLI 路径：Windows 默认 `C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat`。建议设置环境变量：
     ```powershell
     setx WX_IDE_PATH "C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat"
     ```
2. **运行端到端测试**  
   - 推荐执行 `npm run test:e2e:patients`：脚本会使用云开发数据库生成带有 `TEST_AUTOMATION_` 前缀的演示数据，串联执行端到端测试，并在运行结束（含失败场景）后自动清理测试数据。
   - 如仅需复用已有数据，可执行 `npm run test:e2e`；脚本会调用 `miniprogram-automator.launch` 自动启动 IDE（无需手动先开窗口），加载 `project.config.json`，然后驱动 `/pages/index/index` 页面。
3. **可选配置**  
   - `tests/e2e/config/devtools.js` 会自动检测 CLI 路径，也可通过环境变量覆盖：
     - `WX_IDE_PATH` 或 `WX_DEVTOOLS_CLI`：CLI 完整路径。
     - `WX_MINIAPP_PROJECT`：项目根目录（默认为当前仓库）。
     - `WX_IDE_LAUNCH_ARGS`：额外启动参数（JSON 数组）。
   - 测试结束后 `automator` 会关闭 IDE；如需保留窗口，可暂时注释 `afterAll` 的 `miniProgram.close()`。

## 编码注意事项

- PowerShell 环境建议执行一次：
  ```powershell
  $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8NoBOM'
  $PSDefaultParameterValues['Set-Content:Encoding'] = 'utf8NoBOM'
  $PSDefaultParameterValues['Add-Content:Encoding'] = 'utf8NoBOM'
  ```
  这样后续使用 `Set-Content`/`Out-File` 时不会再写入 BOM。
- 编辑器（如 VS Code）保持「UTF-8」编码（非 UTF-8 with BOM），本仓库已提供 `.editorconfig` 协助统一配置。
- 若从其他工具生成文件，可随时执行 `npm run fix-encoding` 进行快速修复。

## 环境变量说明

在根目录 `.env` 中配置以下字段：

- `WECHAT_MINIAPP_ID`：小程序 `AppID`
- `WECHAT_MINIAPP_SECRET`：小程序密钥（仅在服务端使用，请勿暴露）
- `TCB_ENV`：云开发环境 ID
- `NODE_ENV`：运行环境标识（development 或 production）

更新 `.env` 后，重新执行 `npm run sync-config` 以同步配置。
