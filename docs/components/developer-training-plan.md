# 基础组件升级 — 开发者培训计划

此培训计划面向负责实施 `pm-button`、`pm-card`、`pm-input` 等基础组件升级的工程师，确保团队统一理解设计令牌、编码规范与测试要求。培训时间建议安排在 1~1.5 周内完成，可根据团队规模灵活调整。

## 1. 目标与成果

- 理解 `docs/components/base-component-api-plan.md` 中定义的组件 API 与状态矩阵。
- 熟悉设计令牌接入方式（`design-tokens.json` → `npm run tokens:generate` → `foundation`/`utilities`）。
- 掌握 Stylelint/ESLint/Prettier 统一校验流程，避免裸色值与覆盖基础类。
- 能够在 Component Lab 中新增示例并编写对应的 Jest 单元测试。
- 最终每位受训工程师完成至少一个组件的重构并通过验收走查。

## 2. 受训对象

- 前端开发工程师（含主导与协作角色）。
- 代码评审参与者（需了解新 API 审查要点）。
- 设计/QA 可旁听了解实现细节。

## 3. 培训安排

| 模块                                   | 时长   | 内容                                                                                                                                                       | 输出                                                     |
| -------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 模块 A：设计令牌与样式基线             | 0.5 天 | 讲解 `design-tokens.json`、`foundation.wxss`、`utilities.wxss`、Stylelint 规则（`lint:style`、`project/no-foundation-overrides`）、Token Migration Summary | 现场演示 `npm run tokens:generate` 与 Stylelint 运行截图 |
| 模块 B：组件 API 深入                  | 0.5 天 | 逐条解读 `base-component-api-plan`，覆盖状态、事件、插槽；对照设计稿演示                                                                                   | 组件 API 对照表（打印或共享文档）                        |
| 模块 C：实战练习（pm-button）          | 1 天   | 在练习分支实现 `pm-button` 新 API（含 loading/ghost/elevated），编写 Jest 测试和 Component Lab 示例                                                        | 提交练习分支、Stylelint + Jest 通过截图                  |
| 模块 D：实战练习（pm-input / pm-card） | 1 天   | 分组完成另一组件重构，处理 helper/error/prefix slot 等场景                                                                                                 | Demo 演示 + 代码走查记录                                 |
| 模块 E：质量与交付                     | 0.5 天 | 讲解 lint-staged、CI 中 `lint:style`/`test:unit` 运行，如何更新 Story 文档与 CHANGELOG                                                                     | 完成一份 QA 自检清单                                     |

## 4. 培训前准备

1. 讲师提前创建示例分支（含未迁移的 `pm-button` 旧代码）。
2. 预装依赖并验证以下命令：
   ```bash
   npm install
   npm run lint:style
   npm run test:unit
   npm run tokens:generate
   ```
3. 准备 Component Lab 最新资源，用于演示多状态组件。

## 5. 课堂资料

- `docs/components/base-component-api-plan.md`
- `docs/design-system/token-migration-summary.md`
- `docs/design-system/design-tokens-spec.md`
- `docs/design-system/figma-component-library.md`
- 录屏或截图：Stylelint 失败/通过示例、Component Lab 实时预览。

## 6. 考核与验收

- **阶段作业**：每位学员需完成指定组件的重构，并提交 PR（或草稿演示）。
- **代码走查**：讲师 + 设计/QA 进行一次走查，确认 API、样式、测试覆盖。
- **知识点问答**：随机抽问令牌使用、Stylelint 规则含义、组件状态处理。
- **合格标准**：
  - `npm run lint:style`、`npm run test:unit` 均通过。
  - Component Lab 示例完整覆盖 `type/size/state`。
  - 文档更新到位（CHANGELOG、组件 README 或 Story）。

## 7. 培训后跟进

1. 每两周回顾组件升级进度，检查 API 约定执行情况。
2. 维护 FAQ：记录实现中遇到的问题与解决方案，沉淀到 `docs/components/` 目录。
3. 将培训内容纳入新人 onboarding，确保新成员快速掌握组件规范。

## 8. 附录

- **常用命令清单**：
  ```bash
  npm run lint:style          # Stylelint 校验
  npm run test:unit           # Jest 单测
  npm run tokens:generate     # 设计令牌生成
  npm run docs:serve          # 本地预览文档
  ```
- **推荐阅读**：
  - 《Design Systems Handbook》
  - 微信小程序官方组件开发规范
  - `stylelint-config-standard` 与自定义插件文档

完成本培训后，团队应具备独立升级基础组件、保持视觉一致性与质量可控的能力。
