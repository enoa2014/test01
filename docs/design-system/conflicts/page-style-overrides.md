# 页面与基础样式冲突审查（2025-09）

本页记录已发现的页面样式与 `foundation.wxss` 定义冲突的场景及处理方式，帮助后续维护 Stylelint 规则与样式一致性。

## 检查范围

- Stylelint 自定义规则 `project/no-foundation-overrides`（`.stylelintrc.cjs`）会阻止页面重定义以下基础类：`.h-display`、`.h1`、`.h2`、`.h3`、`.subtitle`、`.body`、`.caption`、`.section`、`.divider`。
- 页面若需局部调整，应创建独立类名（例如 `.hero-subtitle`）或使用 `utilities` 类组合。

## 已处理冲突

| 日期       | 文件                                      | 原始冲突                        | 处理方式                                                      | 备注                     |
| ---------- | ----------------------------------------- | ------------------------------- | ------------------------------------------------------------- | ------------------------ |
| 2025-09-23 | `pages/index/index.wxss`                  | 自定义 `.subtitle` 覆盖基础样式 | 更名为 `.hero-subtitle`，保留原始基础类（Stylelint 校验通过） | 参见提交 `TODO` 更新记录 |
| 2025-09-23 | （已移除）`pages/patient-intake/select/select.wxss` | `.subtitle` 历史记录 | 页面已下线，保留记录供追溯 | — |

## 仍需关注

- 若新增页面仍想复用 `.subtitle` 等基础类，可直接在 WXML 中引用，无需新样式；若样式确需改动，请遵循“新类 + utilities”模式。
- 计划新增 Stylelint 检查：避免 `.text-*`、`.bg-*` 等 utilities 被覆盖（待评估）。

## 参考

- `docs/design-system/token-migration-summary.md`
- `docs/components/base-component-api-plan.md`
- `TODO` 设计令牌任务章节

本清单需在发现新的冲突时及时更新。若将来移除自定义类或合并样式，也请记录在此以供审计。
