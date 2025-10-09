# Repository Guidelines

## 项目结构与模块组织
本仓库围绕微信小程序与云开发形成双端协作：`miniprogram/` 存放前端页面、组件与配置，`cloudfunctions/` 承载业务云函数（含 `patientProfile`、`readExcel` 等关键服务），`scripts/` 汇总自动化脚本（配置同步、Tailwind 构建、E2E 运行等），`tests/` 分为 `unit/`、`service/`、`e2e/` 三套测试目录，`styles/` 与 `src/styles/` 管理设计令牌与生成的 WXSS 资源。设计文档与操作手册集中在 `docs/` 及根目录的专项 Markdown 报告，便于贡献者快速对照背景信息。

## 构建、测试与开发命令
- `npm run sync-config`：读取 `.env` 并生成 `project.config.json` 及云环境变量，首次拉取或更新配置后务必执行。
- `npm run tailwind:build` / `npm run build:dev` / `npm run build:prod`：生成小程序端 Tailwind WXSS 资产，提交前确认无警告输出。
- `npm run lint`、`npm run lint:style`、`npm run format:check`：分别校验 JS、WXSS 与通用格式；配合 `npm run lint-staged` 于提交前修复。
- `npm run test:unit`、`npm run test:service`、`npm run test:e2e:patients`：对应前端单测、云函数测试与端到端流程；`npm run test:e2e` 会串联 Mpflow 自动化与清理脚本。
- 数据脚本：`npm run database:verify` 用于验证数据一致性，`npm run database:backup` 在批量操作前创建备份。

## 编码风格与命名约定
使用 `.editorconfig` 统一 LF、UTF-8 与 2 空格缩进；目录与 WXML 资源遵循短横线命名（如 `patient-detail`），JS/TS 中函数与常量沿用 camelCase，云函数文件允许根据动作分模块（`patientProfile/list.js` 等）。通过 ESLint、Prettier、Stylelint 组合保持风格一致，设计令牌新增后需执行 `npm run tokens:generate` 以同步 `miniprogram/` 与 `styles/`。

## 测试指引
单元测试使用 Jest 与 Testing Library，文件放置在 `tests/unit/**`，命名保持 `*.test.js`；云函数服务测试置于 `tests/service/`，必要时借助 `cross-env NODE_ENV=test` 注入测试配置；端到端脚本位于 `tests/e2e/`，依赖 `miniprogram-automator` 与微信开发者工具 CLI，请确保本地配置 `WX_IDE_PATH`。新增功能应包含至少一种测试形态，并通过 `npm run test:unit:coverage` 追踪覆盖率；若无法覆盖需在 PR 说明原因及手动验证步骤。

## 提交与 Pull Request 指南
仓库启用 Husky 与 Commitlint，遵循 Conventional Commits，类型受限于 `commitlint.config.js`（如 `feat`、`fix`、`chore` 等），示例：`feat(patient-detail): 更新生命体征展示`。提交前执行 lint 与相关测试，确保 `npm run test:e2e` 涉及的数据已清理。PR 描述需涵盖变更背景、主要改动、测试结果（命令或截图），涉及 UI 的更新建议附上微信开发者工具截图；关联 Issue 请在描述或标题中引用。多人协作时优先 rebase 保持线性历史，合并后同步更新本地 `.env` 与 `project.config.json`，避免配置漂移。

## 安全与配置提示
`.env` 存放敏感凭据（AppID、Secret、TCB_ENV），不可提交仓库；变更后立即运行 `npm run sync-config`。端到端测试会向云开发写入 `TEST_AUTOMATION_` 前缀数据，如在异常中断后可用 `npm run test:cleanup` 移除残留。使用 Windows/WSL 协作时，建议通过 `wsl_bridge_client.py` 检查 CLI 连通，确保开发者工具脚本能够跨环境调用。
