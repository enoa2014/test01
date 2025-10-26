# 配置与环境变量

- `.env`：本地开发敏感配置（不纳入版本库）。
- `npm run sync-config`：读取 `.env` 并生成小程序 `project.config.json` 与云环境变量。

## 环境变量清单（示例）

- `APPID`：微信小程序 AppID
- `SECRET`：微信小程序 Secret（仅本地/CI 使用）
- `TCB_ENV`：云开发环境 ID
- `EXCEL_FILE_ID`：readExcel 导入/测试使用的云存储 Excel 文件 ID
- `PATIENT_MEDIA_ALLOW_DEV_BYPASS`：患者媒体鉴权开关（开发可 `true`，生产建议 `false`）
- `WX_IDE_PATH`：本机微信开发者工具 CLI 路径（E2E 依赖）

## 安全建议

- `.env` 不要提交到仓库；变更后立即 `npm run sync-config`。
- 生产环境关闭 `PATIENT_MEDIA_ALLOW_DEV_BYPASS`，启用鉴权。
- 执行 `readExcel.resetAll` 前务必先备份数据（`npm run database:backup`）。

## 参考
- 脚本：scripts/ 下的同步/构建/数据库工具
- 文档：dev-environment/setup.md、cloudfunctions/read-excel/README.md

