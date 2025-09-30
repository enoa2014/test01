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
    index/             # 主页患者列表
    analysis/          # 数据分析页面
    patient-detail/    # 患者详情页面（支持编辑预填）
    patient-intake/    # 患者入住流程
cloudfunctions/        # 云函数目录（2025-09-25 重构）
  envList.js           # 与前端共用的环境配置
  patientProfile/      # 患者档案业务查询（新增）
  readExcel/           # Excel数据初始化（重构）
  patientIntake/       # 患者入住管理
  patientMedia/        # 患者媒体文件管理
  dashboardService/    # 仪表板数据服务
  helloWorld/          # 示例云函数
scripts/
  sync-config.js       # 同步 .env 的工具脚本
  fix-encoding.js      # 将文件重写为 UTF-8 无 BOM
  test-deployment.js   # 云函数部署测试脚本

tests/
  unit/                # 单元测试
    pages/             # 页面单元测试
    setup.js           # 全局测试配置
  service/             # 云函数服务测试
  e2e/                 # 端到端测试
    config/            # 端到端测试配置
    specs/             # Jest 测试用例
    jest.config.cjs    # Jest 配置文件
    run-patient-suite.js # 患者测试套件管理
```

## 常用命令

### 基础开发命令
- `npm run tokens:generate`：根据 `design-tokens.json` 生成小程序可用的样式令牌文件。
- `npm run sync-config`：根据 `.env` 同步 `project.config.json` 及环境配置文件。
- `npm run fix-encoding`：遍历 `miniprogram/` 和 `cloudfunctions/`，将 JSON/WXML/WXSS/JS 文件统一写成 UTF-8 无 BOM。

### 测试命令
- `npm run test:e2e:patients`：生成测试患者数据、执行端到端测试并在结束后自动清理。
- `npm run test:e2e` 或 `npm test`：执行端到端测试套件（自动启动微信开发者工具 CLI）。

### 数据库管理命令
- `npm run database:reinit`：完整的数据库重新初始化（清空→导入→验证）。
- `npm run database:backup`：带备份的数据库重新初始化（备份→清空→导入→验证）。
- `npm run database:verify`：仅验证当前数据库数据完整性，不执行任何修改操作。

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

## 云函数架构 (2025-09-25 重构)

项目采用职责分离的云函数架构，提升系统可维护性和性能：

### 核心云函数

- **`patientProfile`** (新增): 专门处理前端业务的患者档案查询
  - `action: 'list'`: 获取患者列表，支持强制刷新
  - `action: 'detail'`: 根据患者key获取详细信息
  - 特性: 30分钟智能缓存、分批读取、优化分组算法

- **`readExcel`** (重构): 专注Excel数据初始化和同步
  - `action: 'import'`: 从Excel文件导入数据到数据库
  - `action: 'syncPatients'`: 同步数据到患者集合
  - `action: 'test'`: 测试Excel解析功能

- **`patientIntake`**: 患者入住管理流程
- **`patientMedia`**: 患者媒体文件管理
- **`dashboardService`**: 仪表板数据服务

### 数据流架构
```
Excel文件 → readExcel(import) → excel_records
excel_records → readExcel(syncPatients) → patients
excel_records → patientProfile(list/detail) → 前端业务
```

### 前端调用更新
所有页面已更新为调用 `patientProfile` 而非 `readExcel`：
- 主页: `wx.cloud.callFunction({ name: 'patientProfile', data: { action: 'list' } })`
- 详情页: `wx.cloud.callFunction({ name: 'patientProfile', data: { action: 'detail', key } })`

## 患者资料管理

- 在患者详情页的"资料管理"模块上传/浏览图片与文档，支持 JPG/PNG/WebP 及 TXT/PDF/Word/Excel。
- 单个文件不超过 10MB，单次最多 5 个，系统自动校验总数量（20）和总容量（30MB）。
- 支持缩略图展示、原图预览与下载，TXT 文档在线预览。
- 仅后台授权用户可操作，云函数位于 `cloudfunctions/patientMedia`，前端入口在 `miniprogram/pages/patient-detail`。

## 数据库管理

### 数据库集合说明

项目使用以下云数据库集合：

| 集合名称 | 用途 | 记录类型 |
|---------|------|----------|
| `excel_records` | Excel原始数据存储 | 患者入院记录原始数据 |
| `excel_cache` | 患者汇总缓存 | 30分钟TTL的患者列表缓存 |
| `patients` | 患者档案 | 去重后的患者基本信息 |
| `patient_intake_records` | 入住记录 | 患者入住流程记录 |

### 数据库重新初始化

当需要清空数据库并重新从Excel文件导入数据时，可以使用以下命令：

```bash
# 完整重新初始化（推荐）
npm run database:reinit

# 带数据备份的重新初始化（重要数据场景）
npm run database:backup

# 仅验证数据完整性（不修改数据）
npm run database:verify
```

### 重新初始化流程

1. **数据清空**：删除所有相关集合中的数据
2. **数据导入**：从Excel文件重新读取并导入原始数据
3. **数据同步**：生成患者档案和入住记录
4. **缓存重建**：生成新的缓存数据
5. **完整性验证**：确保数据一致性和完整性

### 故障排除

如果重新初始化后前端显示数据不完整，请检查：

1. **环境变量**：确保 `TCB_ENV`、`TENCENTCLOUD_SECRETID`、`TENCENTCLOUD_SECRETKEY` 正确设置
2. **Excel文件**：确认 `EXCEL_FILE_ID` 指向正确的云存储文件
3. **云函数部署**：确保 `readExcel` 和 `patientProfile` 云函数已部署最新版本
4. **缓存清理**：运行 `npm run database:verify` 检查数据状态

详细的操作指南请参阅：[docs/database-reinit-guide.md](docs/database-reinit-guide.md)