# 技术栈基线

结合当前代码与配置（`package.json`, `mpflow.config.js`, `jest.e2e.config.js`, `cloudfunctions/` 等），本节总结项目的核心技术选型、用途及维护要点。

## 1. 客户端（微信小程序）

| 技术/库                                                              | 版本/位置                                 | 用途                       | 备注                                                               |
| -------------------------------------------------------------------- | ----------------------------------------- | -------------------------- | ------------------------------------------------------------------ |
| 微信小程序原生框架                                                   | —                                         | 页面/组件开发              | 结合 `app.json`、`project.config.json` 管理路由与配置              |
| 设计令牌体系 (`design-tokens.json` → `styles/generated/tokens.wxss`) | 自研                                      | 统一颜色、间距、阴影等样式 | Story 001.1 产出，运行 `npm run tokens:generate` 生成 WXSS/JS 变量 |
| Component Lab                                                        | `wx-project/pages/component-lab`          | 组件示例与调试             | 开发态启用，发布前需移除入口                                       |
| Mpflow                                                               | `mpflow.config.js`、`mpflow-service` 脚本 | 构建、E2E 测试与项目脚手架 | 结合 `test:e2e` 脚本运行                                           |
| WXSS/PostCSS 工具链                                                  | WXSS 原生 + Stylelint                     | 样式规则与校验             | 通过 `lint:style` 维护一致性                                       |

## 2. 工具与工程化

| 工具                | 定位              | 说明                                                            |
| ------------------- | ----------------- | --------------------------------------------------------------- |
| Node.js 18 LTS      | 运行时            | `.nvmrc` 暂未提供，文档约定使用 18.x                            |
| npm / pnpm          | 包管理            | 默认使用 `npm`；如需可本地使用 `pnpm`（见 `docs/dev-environment/setup.md`） |
| Jest                | 单元测试          | `tests/unit/jest.config.js` 配置覆盖率门槛 80%                  |
| Husky + lint-staged | Git Hooks         | `prepare` 脚本安装；`pre-commit` 运行 lint/fix                  |
| Commitlint          | 提交规范          | `commitlint.config.js` 约束 Conventional Commits                |
| ESLint & Prettier   | 代码风格          | 配置位于仓库根目录，结合 VS Code 插件使用                       |
| Stylelint           | 样式检查          | 通过 `lint:style` 针对 WXSS 运行                                |
| Babel               | `babel.config.js` | 为 Jest 转译代码（当前使用 `@babel/preset-env`）                |

## 3. 云函数与后端协作

| 项目              | 说明                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `cloudfunctions/` | 包含 `patientProfile`、`patientIntake`、`readExcel`、`patientMedia`、`patientService` 等，采用 Node.js + 腾讯云 SDK (`@cloudbase/node-sdk`)。 |
| API 协议          | 小程序以云函数为主；`docs/api/business-components.md` 提供 REST 等效接口参考以便前后端对齐。            |
| 审计/安全         | 云函数统一返回 `{ success, data }` 或 `{ success: false, error }`；若落地网关则采用 `{ code, message, data }` 协议。 |

## 4. 测试体系

- 单元测试：Jest + 组件 mock（`tests/unit/components/*.test.js`）。
- 端到端测试：Mpflow E2E（`npm run test:e2e`）
- 覆盖率：在 CI 上执行 `npm run test:unit`，门槛 ≥ 80%。
- 推荐新增：组件集成示例页面与视觉回归（未来规划）。

## 5. 自动化与交付

- GitHub Actions（规划中）：`docs/dev-environment/ci-cd-guide.md` 提供流水线示例，包括 lint、test、build 阶段。
- 发布策略：主分支稳定，`feature/*` → `develop` → `release/*` → `main`。体验版通过微信 CLI 上传。

## 6. 文档与协作

- 项目文档：`docs/` 目录按主题拆分（architecture、business-components、design-system 等）。
- 设计系统：Story 001.1 的输出 (`docs/design-system/`)，组件需复用令牌与规范。
- 业务组件：Story 001.4 的输出 (`docs/business-components/`)，前后端根据此文档联调。

## 7. 规划中的扩展

- 轻量状态管理工具（与 EventBus/ComponentRegistry 搭配）
- 组件演示 + 自动化测试联动（Component Lab 与 Jest/CI）
- 性能监控与埋点（结合 `docs/business-components/integration-guide.md`）

本技术栈基线应随依赖与工具更新同步维护，并与 QA、开发、设计同步。
