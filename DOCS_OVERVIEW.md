# 文档索引总览

该文档汇总了项目根目录 (`./`) 及主要子目录下的现有文档，便于快速定位。

## 根目录文档
- **README.md**：项目概述、启动与开发指南。
- **TODO.md**：患者列表页 UI 重构计划与阶段任务跟踪。
- **AGENTS.md / CLAUDE.md / TESTING-INTAKE-RECORDS.md** 等：BMAD 代理、外部说明及测试记录。
- **stage2-manual-testing-checklist.md / stage3-implementation-report.md**：阶段性测试与实施汇总。
- **patient-*.md / smart-search-bar-structure.md**：业务组件、用例与性能说明。

## /docs 目录
- `docs/business-components/`：业务组件规范（如 `patient-card.md`）。
- `docs/design-system/`：设计系统与设计令牌规范（如 `design-tokens-spec.md`）。
- 其他子目录记录手动测试、性能与视觉比对等材料。

## /tests 文档
- `tests/e2e/`：端到端测试用例与环境说明（`setup.js`、`helpers/`）。
- `tests/unit/README.md`（如存在）：单元测试配置说明。

## 组件与页面文档
- `miniprogram/components/business/*/README.md`：业务组件使用说明。
- `miniprogram/pages/*` 若包含 README，记录页面级指南。

## 其他资源
- `/scripts/`：自动化脚本（如 E2E 清理脚本 `scripts/e2e/verify-cleanup.js`）。
- `/prepare/`：部署与配置准备相关说明。

> 如需新增文档，请更新本索引保持同步。
