# 基础组件 API 规划

本文档定义 `pm-button`、`pm-card`、`pm-input`、`pm-tag` 等核心基础组件的属性、插槽与事件规划，作为后续重构的实施依据。所有设计需遵循 Story 001.1 的设计令牌体系，通过 `foundation.wxss`、`utilities.wxss` 和 `design-tokens.json` 输出的变量实现。

## 1. pm-button

| 分类 | 名称             | 类型                                                         | 默认值    | 说明                                                                                           |
| ---- | ---------------- | ------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------- |
| 属性 | `type`           | `default` \| `primary` \| `secondary` \| `ghost` \| `danger` | `default` | 控制配色及语义，映射到 `--button-{type}-*` 令牌。`ghost`、`danger` 使用 utilities 中的前景色。 |
| 属性 | `size`           | `small` \| `medium` \| `large`                               | `medium`  | 影响高度、字体大小、padding。                                                                  |
| 属性 | `block`          | `boolean`                                                    | `false`   | 是否占满容器宽度。                                                                             |
| 属性 | `disabled`       | `boolean`                                                    | `false`   | 禁用状态，阻止点击事件。                                                                       |
| 属性 | `loading`        | `boolean`                                                    | `false`   | 显示 loading 指示器，自动禁止点击。                                                            |
| 属性 | `icon`           | `string`                                                     | `''`      | 在文本左侧渲染内置图标。                                                                       |
| 属性 | `iconPosition`   | `left` \| `right`                                            | `left`    | 控制图标位置。                                                                                 |
| 属性 | `elevated`       | `boolean`                                                    | `false`   | 是否开启阴影效果，默认 `var(--shadow-sm)`。                                                    |
| 插槽 | 默认             | —                                                            | —         | 兼容自定义内容（文本、图标）。                                                                 |
| 事件 | `bind:tap`       | —                                                            | —         | 点击事件，禁用/加载状态下不触发。                                                              |
| 事件 | `bind:longpress` | —                                                            | —         | 可选长按事件。                                                                                 |

### 状态管理

- 视觉覆盖 `default`、`hover`、`active`、`focus`、`disabled`、`loading`，统一使用 `transition` 令牌。
- 响应式：`size` 与最小高度/字体映射，保证触摸目标 ≥ 44px。
- 扩展方向：支持 `link` 风格或 `icon-only` 按钮。

## 2. pm-card

| 分类 | 名称        | 类型                                         | 默认值           | 说明                           |
| ---- | ----------- | -------------------------------------------- | ---------------- | ------------------------------ |
| 属性 | `variant`   | `default` \| `outlined` \| `elevated`        | `default`        | 控制边框/阴影样式。            |
| 属性 | `status`    | `success` \| `warning` \| `danger` \| `info` | `''`             | 语义状态，影响边框或标题颜色。 |
| 属性 | `clickable` | `boolean`                                    | `false`          | 允许点击，提供按压反馈与事件。 |
| 属性 | `padding`   | `string`                                     | `var(--space-5)` | 自定义内边距。                 |
| 插槽 | `header`    | —                                            | —                | 标题区，可放置图标、按钮。     |
| 插槽 | 默认        | —                                            | —                | 卡片主体内容。                 |
| 插槽 | `footer`    | —                                            | —                | 操作按钮或辅助信息。           |
| 事件 | `bind:tap`  | —                                            | —                | `clickable=true` 时触发。      |

### 状态管理

- `variant=outlined` 仅使用描边；`elevated` 默认 `var(--shadow-sm)`，hover 提升至 `var(--shadow-md)`。
- `status` 边框与标题文字使用 `--color-{status}`。

## 3. pm-input

| 分类 | 名称                        | 类型                                      | 默认值                             | 说明                                        |
| ---- | --------------------------- | ----------------------------------------- | ---------------------------------- | ------------------------------------------- |
| 属性 | `value`                     | `string`                                  | `''`                               | 受控值。                                    |
| 属性 | `placeholder`               | `string`                                  | `''`                               | 占位符。                                    |
| 属性 | `type`                      | `text` \| `number` \| `digit` \| `idcard` | `text`                             | 同微信 `<input>` 类型。                     |
| 属性 | `size`                      | `small` \| `medium` \| `large`            | `medium`                           | 控制高度与字体。                            |
| 属性 | `labelPosition`             | `top` \| `left`                           | `top`                              | 标签在上方或左侧，左侧模式宽度固定 160rpx。 |
| 属性 | `block`                     | `boolean`                                 | `true`                             | 是否占满宽度。                              |
| 属性 | `clearable`                 | `boolean`                                 | `false`                            | 显示清除图标。                              |
| 属性 | `disabled`                  | `boolean`                                 | `false`                            | 禁用状态。                                  |
| 属性 | `helper`                    | `string`                                  | `''`                               | 辅助文本。                                  |
| 属性 | `error`                     | `string`                                  | `''`                               | 错误提示，优先级高于 helper。               |
| 属性 | `prefixIcon` / `suffixIcon` | `string`                                  | `''`                               | 输入框前后的小图标。                        |
| 插槽 | `prefix`                    | —                                         | —                                  | 自定义前缀内容（如国家码）。                |
| 插槽 | `suffix`                    | —                                         | —                                  | 自定义后缀（如单位）。                      |
| 事件 | `bind:input`                | `{ value }`                               | —                                  | 值变化时触发。                              |
| 事件 | `bind:change`               | `{ value }`                               | —                                  | 失焦或回车时触发。                          |
| 事件 | `bind:clear`                | —                                         | `clearable` 且点击清除按钮时触发。 |
| 事件 | `bind:focus` / `bind:blur`  | —                                         | 聚焦状态变化。                     |

### 状态管理

- 聚焦边框与阴影采用 `var(--color-info)` + `var(--shadow-xs)`。
- `error` 状态覆盖边框/提示颜色；禁用时背景使用 `var(--color-border-secondary)`。

## 4. pm-tag（规划）

| 分类 | 名称         | 类型                                                         | 默认值         | 说明                                  |
| ---- | ------------ | ------------------------------------------------------------ | -------------- | ------------------------------------- |
| 属性 | `type`       | `default` \| `primary` \| `success` \| `warning` \| `danger` | `default`      | 语义颜色，映射到 `color-*` 令牌。     |
| 属性 | `size`       | `small` \| `medium`                                          | `small`        | 控制高度与内边距。                    |
| 属性 | `closable`   | `boolean`                                                    | `false`        | 是否显示关闭按钮并触发 `bind:close`。 |
| 属性 | `outline`    | `boolean`                                                    | `false`        | 描边样式，背景透明。                  |
| 属性 | `icon`       | `string`                                                     | `''`           | 在文字前显示图标。                    |
| 插槽 | 默认         | —                                                            | —              | tag 内容。                            |
| 事件 | `bind:tap`   | —                                                            | 点击事件。     |
| 事件 | `bind:close` | —                                                            | 关闭按钮点击。 |

## 5. QA / 示例

- Component Lab：为上述组件提供尺寸、语义、禁用、加载状态示例。
- Story 文档：完成后同步更新 `docs/design-system/component-specifications.md`。
- 测试计划：
  - 单测覆盖属性渲染、事件派发、受控行为。
  - 视觉回归：后续接入截图比对。

## 6. 后续任务

1. 根据此文档，重构 `pm-button`/`pm-card`/`pm-input`，并新增 `pm-tag`。
2. 输出 TypeScript 类型定义至 `miniprogram/components/base/types.d.ts`（规划）。
3. 在 Stylelint 中增加组件命名约束（例如 `.pm-button__*`）。
4. 将实现进度更新至 `TODO.md`（基础组件升级章节）。
