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

| 分类 | 名称                        | 类型                                                    | 默认值     | 说明                                                                  |
| ---- | --------------------------- | ------------------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| 属性 | `label`                     | `string`                                                | `''`       | 标签文案。                                                            |
| 属性 | `value`                     | `string`                                                | `''`       | 受控值。                                                              |
| 属性 | `placeholder`               | `string`                                                | `'请输入'` | 占位提示。                                                            |
| 属性 | `type`                      | `text` \| `number` \| `digit` \| `idcard` \| `textarea` | `text`     | 同原生 `<input>`/`<textarea>` 类型，`textarea` 模式自动切换多行控件。 |
| 属性 | `maxlength`                 | `number`                                                | `-1`       | 最大输入长度，`-1` 表示不限。                                         |
| 属性 | `size`                      | `small` \| `medium` \| `large`                          | `medium`   | 控制高度、字体与内边距。                                              |
| 属性 | `labelPosition`             | `top` \| `left`                                         | `top`      | 标签位置，左侧模式宽度固定 160rpx。                                   |
| 属性 | `block`                     | `boolean`                                               | `true`     | 是否占满父容器宽度。                                                  |
| 属性 | `clearable`                 | `boolean`                                               | `true`     | 显示清除按钮（禁用或空值时自动隐藏）。                                |
| 属性 | `disabled`                  | `boolean`                                               | `false`    | 禁用状态。                                                            |
| 属性 | `required`                  | `boolean`                                               | `false`    | 是否展示必填标记（仅视觉提示）。                                      |
| 属性 | `helper`                    | `string`                                                | `''`       | 辅助提示文本，展示在输入框下方。                                      |
| 属性 | `error`                     | `string`                                                | `''`       | 错误提示，高于 helper 与 hint。                                       |
| 属性 | `hint`                      | `string`                                                | `''`       | 额外提示信息，显示在 helper 区域。                                    |
| 属性 | `prefixIcon` / `suffixIcon` | `string`                                                | `''`       | 内置图标名称，位于输入框前/后。                                       |
| 属性 | `usePrefixSlot`             | `boolean`                                               | `false`    | 是否启用 `prefix` 自定义插槽。                                        |
| 属性 | `useSuffixSlot`             | `boolean`                                               | `false`    | 是否启用 `suffix` 自定义插槽。                                        |
| 属性 | `textareaAutoHeight`        | `boolean`                                               | `true`     | `type="textarea"` 时是否根据内容自动增高。                            |
| 属性 | `showConfirmBar`            | `boolean`                                               | `true`     | `type="textarea"` 时是否保留系统工具栏。                              |
| 插槽 | `prefix`                    | —                                                       | —          | 自定义前缀（如国家码、标签）。                                        |
| 插槽 | `suffix`                    | —                                                       | —          | 自定义后缀（如单位、跳转按钮）。                                      |
| 事件 | `bind:input`                | `{ value }`                                             | —          | 输入过程中触发。                                                      |
| 事件 | `bind:change`               | `{ value }`                                             | —          | 受控值确认事件；文本框回车或失焦触发，textarea 在 `blur` 时触发。     |
| 事件 | `bind:clear`                | —                                                       | —          | 点击清除按钮触发。                                                    |
| 事件 | `bind:focus` / `bind:blur`  | `{ value }`                                             | —          | 聚焦状态变化。                                                        |

### 状态管理

- 聚焦边框与阴影采用 `var(--color-info)` + `var(--shadow-xs)`。
- `error` 状态覆盖边框/提示颜色；禁用时背景使用 `var(--color-border-secondary)`。

## 4. pm-picker（规划）

| 分类 | 名称                  | 类型                                                                    | 默认值     | 说明                                                |
| ---- | --------------------- | ----------------------------------------------------------------------- | ---------- | --------------------------------------------------- |
| 属性 | `value`               | `string` \| `number` \| `Array<string \| number>`                       | `''`       | 当前选中值，支持单选（字符串/数字）与多选（数组）。 |
| 属性 | `options`             | `{ label: string, value: string \| number, description?, disabled? }[]` | `[]`       | 备选项数据源。`description`/`disabled` 可选。       |
| 属性 | `placeholder`         | `string`                                                                | `'请选择'` | 无值时的占位提示。                                  |
| 属性 | `multiple`            | `boolean`                                                               | `false`    | 是否启用多选模式，启用后 `value` 需为数组。         |
| 属性 | `searchable`          | `boolean`                                                               | `false`    | 是否允许输入过滤。                                  |
| 属性 | `clearable`           | `boolean`                                                               | `true`     | 是否显示清除按钮。                                  |
| 属性 | `disabled`            | `boolean`                                                               | `false`    | 禁用状态。                                          |
| 属性 | `loading`             | `boolean`                                                               | `false`    | 是否展示加载中的骨架/副文本。                       |
| 属性 | `label`               | `string`                                                                | `''`       | 标签文案，与 pm-input 保持一致。                    |
| 属性 | `labelPosition`       | `top` \| `left`                                                         | `top`      | 标签位置，允许复用 pm-input 的样式逻辑。            |
| 属性 | `block`               | `boolean`                                                               | `true`     | 是否占满父容器宽度。                                |
| 属性 | `helper`              | `string`                                                                | `''`       | 辅助提示文本。                                      |
| 属性 | `error`               | `string`                                                                | `''`       | 错误提示。                                          |
| 属性 | `hint`                | `string`                                                                | `''`       | 额外提示信息。                                      |
| 属性 | `dropdownPlacement`   | `auto` \| `top` \| `bottom`                                             | `auto`     | 下拉面板位置策略。                                  |
| 属性 | `maxTagCount`         | `number`                                                                | `3`        | 多选时最多展示 tag 数量，其余合并为 `+N`。          |
| 插槽 | `option`              | —                                                                       | —          | 自定义选项内容（透传 `item`, `active` 状态）。      |
| 插槽 | `prefix`/`suffix`     | —                                                                       | —          | 输入框前后缀内容，用于放置图标、按钮。              |
| 事件 | `bind:open` / `close` | —                                                                       | —          | 弹层展开/收起时触发。                               |
| 事件 | `bind:change`         | `{ value, selectedOptions }`                                            | —          | 选项确认时触发，返回当前值和完整的选项对象数组。    |
| 事件 | `bind:search`         | `{ keyword }`                                                           | —          | 搜索模式下输入时触发。                              |
| 事件 | `bind:clear`          | —                                                                       | —          | 点击清除按钮时触发。                                |

### 交互说明

- 下拉面板最大高度建议 60vh，超出启用滚动；多选模式提供勾选框与全选按钮。
- 搜索模式下可在顶部展示 `pm-input` 作为过滤器，触发 `bind:search` 供外部请求远端数据。
- 支持 `options` 懒加载：当 `loading=true` 时显示骨架，禁用交互，外部在数据就绪后切换为 false。

### 扩展方向

- 级联模式（`cascade=true`）可用于选择省市区；未来可拓展为树型结构。
- 支持 `badge` / 自定义状态装饰，可复用 `pm-badge`。

## 5. pm-radio（规划）

| 分类 | 名称                | 类型                                                                    | 默认值     | 说明                                                          |
| ---- | ------------------- | ----------------------------------------------------------------------- | ---------- | ------------------------------------------------------------- |
| 属性 | `value`             | `string` \| `number`                                                    | `''`       | 当前选中值。                                                  |
| 属性 | `options`           | `{ label: string, value: string \| number, description?, disabled? }[]` | `[]`       | 选项数据源，`description`/`disabled` 可选。                   |
| 属性 | `direction`         | `horizontal` \| `vertical`                                              | `vertical` | 选项排列方向。                                                |
| 属性 | `buttonStyle`       | `boolean`                                                               | `false`    | 是否以按钮样式展示（适合状态切换场景）。                      |
| 属性 | `size`              | `small` \| `medium`                                                     | `medium`   | 影响按钮/单选圆点尺寸。                                       |
| 属性 | `label`             | `string`                                                                | `''`       | 组件标签文案。                                                |
| 属性 | `labelPosition`     | `top` \| `left`                                                         | `top`      | 标签位置，复用 `pm-input` 对齐逻辑。                          |
| 属性 | `block`             | `boolean`                                                               | `true`     | 是否占满父容器宽度（按钮样式下常用）。                        |
| 属性 | `disabled`          | `boolean`                                                               | `false`    | 全局禁用。                                                    |
| 属性 | `helper`            | `string`                                                                | `''`       | 辅助文案。                                                    |
| 属性 | `error`             | `string`                                                                | `''`       | 错误提示。                                                    |
| 属性 | `hint`              | `string`                                                                | `''`       | 补充提示信息。                                                |
| 属性 | `allowClear`        | `boolean`                                                               | `false`    | 是否允许再次点击已选项取消选择。                              |
| 插槽 | `option`            | —                                                                       | —          | 自定义选项呈现（透传 `item`, `checked`, `disabled` 等状态）。 |
| 插槽 | `prefix` / `suffix` | —                                                                       | —          | 标签区前后缀插槽，可放置说明或按钮。                          |
| 事件 | `bind:change`       | `{ value, option }`                                                     | —          | 选项切换时触发，返回当前值与选项对象。                        |
| 事件 | `bind:clear`        | —                                                                       | —          | `allowClear` 且取消选中时触发。                               |

### 交互说明

- 默认模式下渲染圆形单选按钮，按钮样式下使用 `pm-button` 设计语言（语义色/状态）。
- 支持选项禁用、hover/focus 状态；横向模式在宽度不足时自动换行。
- 提供键盘导航：`left/right/up/down` 在同组内切换，`space/enter` 选中。

### 扩展方向

- 计划支持分组（`groups`），在医疗标签、症状等分类选择场景使用。
- 可与 `pm-tag` 组合形成多选开关模式。

## 6. pm-dialog（规划）

| 分类 | 名称                | 类型                                 | 默认值    | 说明                                                |
| ---- | ------------------- | ------------------------------------ | --------- | --------------------------------------------------- |
| 属性 | `visible`           | `boolean`                            | `false`   | 控制弹窗显隐，外部受控。                            |
| 属性 | `title`             | `string`                             | `''`      | 标题文案，留空时隐藏标题区。                        |
| 属性 | `content`           | `string`                             | `''`      | 主体文本内容，使用默认 slot 可自定义复杂结构。      |
| 属性 | `confirmText`       | `string`                             | `'确定'`  | 确认按钮文案。                                      |
| 属性 | `cancelText`        | `string`                             | `'取消'`  | 取消按钮文案，留空时只显示单按钮。                  |
| 属性 | `confirmType`       | `primary` \| `danger` \| `secondary` | `primary` | 确认按钮语义样式。                                  |
| 属性 | `cancelType`        | `ghost` \| `secondary`               | `ghost`   | 取消按钮样式。                                      |
| 属性 | `showClose`         | `boolean`                            | `true`    | 是否展示右上角关闭图标。                            |
| 属性 | `closeOnOverlay`    | `boolean`                            | `true`    | 点击遮罩是否关闭弹窗。                              |
| 属性 | `maskClosable`      | `boolean`                            | `true`    | 同 `closeOnOverlay`（兼容旧命名），后续仅保留一个。 |
| 属性 | `scrollable`        | `boolean`                            | `false`   | 内容区域超出高度时是否启用内部滚动，默认外部处理。  |
| 插槽 | 默认                | —                                    | —         | 自定义主体内容。                                    |
| 插槽 | `header` / `footer` | —                                    | —         | 自定义头部或底部区域，覆盖标题/按钮。               |
| 事件 | `bind:confirm`      | —                                    | —         | 点击确认按钮触发。                                  |
| 事件 | `bind:cancel`       | —                                    | —         | 点击取消按钮触发。                                  |
| 事件 | `bind:close`        | —                                    | —         | 主动关闭（遮罩/关闭图标）触发。                     |

### 交互说明

- 弹窗居中显示，宽度默认 600rpx，可通过 `style` 覆盖。移动端上下间距保持 48rpx。
- 遮罩透明度采用 `--overlay-modal` 令牌；弹窗背景使用 `--color-bg-primary`，圆角 `--radius-xl`。
- 键盘事件：监听 `cancelable` 时响应 `back`/`escape`，触发 `bind:close`。
- 与 `pm-button` 结合：常规确认/取消按钮使用组件，保持语义一致。

### 扩展方向

- 支持国际化：按钮文案和标题传入多语言资源。
- 支持插入带图标的警示说明（危险操作二次确认）。
- 与 `pm-toast` 区分使用场景：toast 提示信息、dialog 承载决策。

## 7. pm-badge（规划）

| 分类 | 名称      | 类型                                                           | 默认值    | 说明                                 |
| ---- | --------- | -------------------------------------------------------------- | --------- | ------------------------------------ |
| 属性 | `text`    | `string`                                                       | `''`      | 纯文本角标内容。                     |
| 属性 | `count`   | `number` \| `string`                                           | `''`      | 数字角标；为空时不展示数字。         |
| 属性 | `max`     | `number`                                                       | `99`      | 超过该值展示 `max+`。                |
| 属性 | `type`    | `primary` \| `success` \| `warning` \| `danger` \| `secondary` | `primary` | 颜色语义。                           |
| 属性 | `size`    | `small` \| `medium` \| `large`                                 | `medium`  | 控制高度与字号。                     |
| 属性 | `dotted`  | `boolean`                                                      | `false`   | 是否渲染状态点样式（无文本/数字）。  |
| 属性 | `block`   | `boolean`                                                      | `false`   | 是否以胶囊形式占据更大的宽度。       |
| 属性 | `useSlot` | `boolean`                                                      | `false`   | 是否使用插槽自定义内容。             |
| 插槽 | 默认      | —                                                              | —         | 自定义角标内容（图标、文本组合等）。 |

### 使用建议

- 与 `pm-button`、`pm-card` 组合时，可使用 `position: absolute` 将徽章叠加在右上角。
- `dotted` 模式适合作为状态指示，可搭配 `pm-avatar`（后续计划）用于在线状态标记。
- 若需显示长文本，建议开启 `block` 模式并设置 `u-inline-flex` 保持布局。

## 8. pm-tag（规划）

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

## 9. QA / 示例

- Component Lab：为上述组件提供尺寸、语义、禁用、加载状态示例。
- Story 文档：完成后同步更新 `docs/design-system/component-specifications.md`。
- 测试计划：
  - 单测覆盖属性渲染、事件派发、受控行为。
  - 视觉回归：后续接入截图比对。

## 10. 后续任务

1. 根据此文档，重构 `pm-button`/`pm-card`/`pm-input`，并新增 `pm-tag`。
2. 输出 TypeScript 类型定义至 `wx-project/components/base/types.d.ts`（规划）。
3. 在 Stylelint 中增加组件命名约束（例如 `.pm-button__*`）。
4. 将实现进度更新至 `TODO.md`（基础组件升级章节）。
