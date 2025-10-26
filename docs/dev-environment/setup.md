# 开发环境配置与优化指南

## 目标

- 快速搭建统一的本地开发环境，降低新成员加入成本。
- 通过自动化工具保障代码风格、质量与性能基线。
- 为 CI/CD 流水线提供可复制的环境规范。

## 必备工具

| 工具           | 版本建议   | 用途                     |
| -------------- | ---------- | ------------------------ |
| Node.js        | 18 LTS     | 运行脚本、打包与测试     |
| pnpm           | 8.x        | 可选包管理器（本仓库默认使用 npm）   |
| 微信开发者工具 | 最新稳定版 | 运行与调试小程序         |
| Git            | 2.40+      | 版本控制                 |
| VS Code        | 最新稳定版 | 推荐编辑器，配套插件如下 |

### VS Code 推荐插件

- ESLint
- Prettier - Code formatter
- minapp
- Git Graph / GitLens
- DotENV

## 项目结构约定

```
root
├─ docs/                        # 文档与规范
├─ wx-project/                  # 小程序源代码
│   ├─ app.js \ app.json
│   ├─ styles/                  # 全局样式、设计令牌
│   ├─ config/                  # 配置与常量
│   ├─ components/              # 基础 + 业务组件（本故事新增）
│   ├─ pages/                   # 页面文件夹
│   └─ utils/                   # 工具方法
├─ cloudfunctions/              # 云函数代码 (2025-09-25 重构)
│   ├─ patientProfile/          # 患者档案业务查询 (新增)
│   ├─ readExcel/               # Excel数据初始化 (重构)
│   ├─ patientIntake/           # 患者入住管理
│   ├─ patientMedia/            # 患者媒体文件管理
│   ├─ patientService/          # 聚合/代理服务（调用 patientProfile）
│   └─ helloWorld/              # 测试云函数
├─ scripts/                     # 自定义构建、校验脚本
├─ tests/                       # 单元测试与端到端测试入口
└─ package.json
```

## 依赖管理

- 本仓库默认使用 `npm install` 管理依赖；如需 `pnpm` 可本地自行使用（不提供 workspace 配置）。
- 推荐引入以下依赖（若未存在于 package.json）：
  - `@wechat-miniprogram/miniprogram-simulate`：组件单元测试
  - `lint-staged`、`husky`：提交前校验
  - `prettier` 与 `eslint`（含 `eslint-config-alloy` 或自定义配置）
  - `stylelint`：WXSS 样式规范
  - `commitlint`、`@commitlint/config-conventional`
  - `zx` 或 `tsx`：编写工具脚本

## 脚本约定

本仓库可用脚本（节选，详情见根目录 package.json）：

- `npm run sync-config`：同步小程序与云开发配置（读取 .env）
- `npm run tailwind:build`：生成 WXSS 资产
- `npm run build:dev` / `npm run build:prod`：构建示例
- `npm run lint` / `npm run lint:style` / `npm run lint:fix`
- `npm run format` / `npm run format:check`
- `npm run test:unit` / `npm run test:service` / `npm run test:e2e`
- `npm run database:*`：数据库初始化/校验脚本

## 代码格式与校验

1. ESLint：
   - 基于 `@tencent/eslint-config-wxa` 或自定义规则。
   - 开启 `no-undef`, `no-unused-vars`, `eqeqeq`, `prefer-const`。
2. Stylelint：
   - 插件 `stylelint-config-standard` + `stylelint-order`。
   - 约束类名命名（BEM/设计系统令牌）。
3. Prettier：
   - 采用统一风格：单引号、结尾分号、打印宽度 100。
4. lint-staged：
   ```json
   {
     "lint-staged": {
       "*.js": ["eslint --fix", "prettier --write"],
       "*.{wxss,css}": ["stylelint --fix", "prettier --write"],
       "*.{json,wxml,md}": ["prettier --write"]
     }
   }
   ```

## Git Hooks

- `pre-commit`：运行 lint-staged。
- `commit-msg`：使用 commitlint 检查信息，例如 `type(scope): subject`。
- `pre-push`：可选执行单元测试与构建。

## 环境变量与配置

- `.env.example`：列出必须的配置，如 API 网关、静态资源域名、CI Token。
- 本地 `.env.local`：开发者自定义，禁止提交。
- 微信开发者工具导出的 `project.config.json` 建议纳入版本库（敏感字段置空），统一编译配置。

## 缓存与提速建议

- 使用 Node 包缓存（如 GitHub Actions cache）缩短安装时间。
- 在微信开发者工具中启用“增量编译”与“文件监听忽略 node_modules”。
- 对频繁更新的模拟接口使用本地 `json-server` 或轻量 Node 服务，避免线上依赖。

## 常见问题排查

| 现象                    | 原因                             | 解决方案                                                  |
| ----------------------- | -------------------------------- | --------------------------------------------------------- |
| ESLint 未生效           | VS Code 未启用工作区设置         | 检查 `.vscode/settings.json` 是否配置 `  eslint.validate` |
| 提交被拒绝              | lint-staged 或 commitlint 未通过 | 运行 `pnpm lint` / `pnpm test` 修复后重试                 |
| 微信开发者工具卡顿      | 缓存过大或识别 node_modules      | 清理缓存，并在项目设置中排除大型目录                      |
| Jest 无法识别小程序 API | 未 mock 全局对象                 | 在 `tests/setup.ts` 中补充 `wx` 模拟                      |

## 后续工作

- 将本指南纳入入职 checklist。
- 在 CI 中校验 Node 与 pnpm 版本，避免版本漂移。
- 每季度审查依赖与工具版本，关注安全公告。
