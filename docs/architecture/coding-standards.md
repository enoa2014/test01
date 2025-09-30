# Coding Standards Baseline

本基线结合当前患者档案管理小程序代码仓库的实际配置（参见 `.eslintrc.js`, `.prettierrc`, `.husky/`、`package.json` 等文件），用于约束前端与云函数代码的实现方式，确保可维护性与团队协作效率。

## 1. 通用约定
- **语言**：前端（小程序）与云函数均使用 JavaScript (ES2018+)；脚本遵循 Node.js 18 LTS 特性。
- **模块化**：小程序侧使用原生组件化 (`Component`)、页面 (`Page`) 与行为 (`Behavior`)；云函数使用 CommonJS 模块。
- **命名规则**：
  - 变量、函数：`camelCase`；常量：`SCREAMING_SNAKE_CASE`。
  - 组件目录与文件：使用小写连字符，如 `pm-button/index.{js,wxml,wxss}`。
  - WXSS 类名采用 `pm-` 前缀，并遵循 BEM 风格 (`pm-card__header`)。
- **注释**：使用英文说明逻辑，复杂流程需补充“为什么”的解释；禁止保留无意义注释或注释掉的旧代码。

## 2. Lint & Style 规则
- `.eslintrc.js` 扩展 `eslint:recommended`，强制以下关键规则：
  - `no-unused-vars`（允许 `_` 前缀忽略）、`prefer-const`、`no-var`、`eqeqeq`、`no-debugger` 等。
  - 统一 2 空格缩进、单引号、语句末尾分号、对象/数组留空格。
  - 针对测试文件（`**/*.test.js`）关闭 `no-console`；针对云函数允许 `node` 环境。
- `.prettierrc` 设定 `singleQuote: true`、`semi: true`、`printWidth: 100`。WXML/WXSS 使用适配解析器，保持与 ESLint 一致。
- 提交前通过 `lint-staged` 自动执行 `eslint --fix`、`stylelint --fix`（针对 WXSS）与 `prettier --write`。
- 建议在 VS Code 中启用 “Format on Save”，并安装 ESLint/Prettier 插件。

## 3. Git 与提交规范
- 使用 `husky` + `commitlint`：
  - `pre-commit` 执行 lint-staged；
  - `commit-msg` 校验 Conventional Commit（例如 `feat(component): add pm-card`）。
- 主分支禁止直接推送（需通过 PR 流程，详见 `docs/dev-environment/code-review-guidelines.md`）。
- 提交应保证 `npm run test:unit` 通过，避免带入破坏性更改。

## 4. 小程序代码规范
- **结构**：组件/页面以 `index.js` + `index.wxml` + `index.wxss` + `index.json` 组成；样式需 `@import "../../styles/generated/tokens.wxss"` 并结合 `foundation.wxss`、`utilities.wxss` 使用设计令牌。
- **数据绑定**：避免在模板中执行复杂逻辑，预先在 `data` 中准备展示数据。
- **事件**：统一使用 `bindtap`、`bind:change` 等语义化事件并在 JS 中定义同名方法；禁止内联匿名函数。
- **状态管理**：优先使用页面 `setData`；跨组件状态通过事件/全局 Store（参见 Integration Guide）。
- **性能**：
  - 使用骨架屏/`loading` 属性控制渲染。
  - 大列表启用虚拟滚动或分页（参考 Timeline 规范）。
  - 图片、附件使用懒加载与本地缓存策略。
- **无障碍**：为交互元素添加 `aria-label`、`role`，保证 Tab 顺序、键盘操作可用。

## 5. 云函数与脚本
- 云函数位于 `cloudfunctions/`，遵循以下要求：
  - `strict mode`、`async/await` 处理异步；
  - 输入参数须进行校验与错误处理；
  - 统一返回格式 `{ code, message, data }`，记录日志便于排查。
- 脚本（`scripts/`）采用 Node 18 语法，引用 `zx`/`cross-env` 等工具时需写入 README 说明。

## 6. 测试要求
- 单元测试位于 `tests/unit`，使用 Jest。
- 覆盖率门槛：`branches/functions/lines/statements ≥ 80%`（见 `tests/unit/jest.config.js`）。
- 组件测试使用 `Component.mock` 模式验证属性与事件；必要时补充快照或集成测试。

## 7. 安全与质量
- 所有 API 调用必须使用统一的请求封装，处理错误码（参考 `docs/api/business-components.md`）。
- 日志与敏感信息遵循最小暴露原则，不在控制台输出敏感数据。
- 对第三方依赖版本进行定期审查，使用 `npm audit` 处理漏洞。

本文件应随代码/工具链变化进行维护，并与 QA、开发、产品保持一致。
