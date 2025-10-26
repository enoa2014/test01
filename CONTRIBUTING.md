# 贡献指南（中文）

感谢参与本项目！为保持一致性与可维护性，请遵循以下约定。

## 提交流程
- 提交信息：遵循 Conventional Commits（见 `commitlint.config.js`）
  - 示例：`docs(ui-refactor): 拆分大型报告并更新 TOC`
  - 类型建议：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`perf`、`build`、`ci`、`revert`
- 提交前检查：
  - 代码：`npm run lint`、`npm run lint:style`
  - 文档（可选）：`npm run docs:links`

## 文档贡献
- 语言：仅中文内容；文件名使用英文短横线（kebab-case）
- 目录：所有文档位于 `docs/` 下，导航参见 `docs/TOC.md`
- 链接：在 `docs/` 内相互引用时使用相对路径，不要以 `docs/` 作为前缀
  - 例：`design/ui-refactor/overview.md`（而非 `docs/design/ui-refactor/overview.md`）
- 模板：在 `docs/_templates/` 中选择合适模板（ADR、Runbook、Feature Spec、Guide、Testing、UX、Design Delivery）
- 本地检查：可执行 `npm run docs:links` 校验相对链接

## 开发与构建
- 同步配置：更新 `.env` 后执行 `npm run sync-config`
- 样式令牌：令牌变更后执行 `npm run tokens:generate`，并确认 `npm run tailwind:build` 无警告
- 测试：新增功能至少包含一种测试形态（unit / service / e2e）

## 数据与测试
- 端到端测试：优先使用 `npm run test:e2e:patients`（自动清理带 `TEST_AUTOMATION_` 前缀的数据）
- 数据脚本：大批量操作前运行 `npm run database:backup` 进行备份

## 沟通与评审
- PR 描述：包含背景、主要改动、测试结果（命令或截图）；涉及 UI 附上开发者工具截图
- 历史文档：大型历史文档应拆分后迁移至新结构；历史版本以 Git 提交记录为准（不再保留 `docs/archives/`）

谢谢你的贡献！
