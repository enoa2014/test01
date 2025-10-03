# PatientCard 业务组件规范

## 组件简介

PatientCard 用于在列表、概览或详情入口展示患者的核心信息，并提供快捷操作。组件支持列表、紧凑、详情三种视图，并依据患者状态展示不同标记。

## 适用场景

- 仪表盘与患者列表的卡片块
- 患者详情页的概览区域
- 批量操作选择器（可勾选模式）

## 属性定义

| 属性               | 类型    | 默认值   | 必填 | 说明                                                   |
| ------------------ | ------- | -------- | ---- | ------------------------------------------------------ |
| `patient`          | Object  | `{}`     | 是   | 患者数据对象，字段见数据模型                           |
| `mode`             | String  | `list`   | 否   | 展示模式：`list` / `compact` / `detail`                |
| `selectable`       | Boolean | `false`  | 否   | 是否显示选择框                                         |
| `selected`         | Boolean | `false`  | 否   | 当前选中状态（受控）                                   |
| `loading`          | Boolean | `false`  | 否   | 是否展示骨架屏/加载态                                  |
| `actions`          | Array   | `[]`     | 否   | 快捷操作按钮定义，包含 `id`、`label`、`icon`、`danger` |
| `badges`           | Array   | 自动生成 | 否   | 状态徽标列表，可覆盖默认策略                           |
| `showTimelineHint` | Boolean | `false`  | 否   | 是否展示“查看时间轴”提示                               |

## 事件

| 事件名              | 参数                    | 说明               |
| ------------------- | ----------------------- | ------------------ |
| `bind:cardtap`      | `{ patient }`           | 点击卡片本体       |
| `bind:actiontap`    | `{ action, patient }`   | 点击操作按钮       |
| `bind:selectchange` | `{ selected, patient }` | 选择框状态变化     |
| `bind:longpress`    | `{ patient }`           | 长按卡片（移动端） |

## 数据依赖与字段映射

| 字段                  | 说明                                        | 来源 API                           |
| --------------------- | ------------------------------------------- | ---------------------------------- |
| `patient.id`          | 患者主键                                    | `/api/patients/:id`                |
| `patient.name`        | 姓名                                        | `/api/patients/:id`                |
| `patient.age`         | 年龄（按照出生日期动态计算）                | `/api/patients/:id`                |
| `patient.status`      | 状态枚举（in_care、pending、discharged 等） | `/api/patients/:id`                |
| `patient.latestEvent` | 最近事件摘要                                | `/api/patients/:id/events?limit=1` |
| `patient.riskLevel`   | 风险等级，高亮显示                          | `/api/patients/:id/risk`           |
| `patient.avatar`      | 头像 URL 或姓名首字母                       | 静态资源/后端                      |
| `patient.tags`        | 标签数组                                    | `/api/patients/:id/tags`           |

## 状态与 UI 规则

- **风险标记**：`riskLevel` 为 `high` 时显示红色徽标；`medium` 显示橙色；`low` 绿色。
- **在住标记**：`status === 'in_care'` 时展示绿色“在住”标签。
- **待补资料**：若 `patient.missingFields` 非空，顶部显示灰色提示条并提供补全操作。
- **加载态**：`loading` 为 true 时，渲染骨架屏并禁用交互。

## 交互细节

1. 卡片点击触发 `cardtap`，若想阻止默认跳转需在父级处理。
2. `selectable` 为 true 时，卡片左侧展示复选框；点击卡片等价于切换勾选。
3. 操作按钮支持主次样式，遵循设计令牌 `btn-secondary`。
4. 支持键盘操作：回车触发 `cardtap`，空格切换选中。

## 无障碍要求

- 根节点使用 `role="listitem"`。
- 复选框使用原生 `checkbox` 组件，并提供 `aria-label`。
- 状态描述应以文本呈现（如“高风险患者”），确保屏幕阅读器可读。

## 性能要求

- 首次渲染 < 40ms，重渲染 < 25ms。
- 卡片图片应使用懒加载（在列表中使用 `image` 的 `lazy-load`）。

## 测试建议

- 属性渲染：不同 `mode`、`status`、`riskLevel`、`missingFields`。
- 事件触发：点击卡片、操作按钮、选择框、长按。
- 无障碍：Tab/Enter/Space 键操作是否正确。
- 快照：对三种模式生成快照，防止 UI 回归。

## 接口错误处理

- 当基础数据请求失败时，显示错误占位（`error` 模式），按钮改为“重试”。
- 单个按钮失败需在 `actiontap` 响应中反馈错误，由上层决定是否 Toast。

## 版本记录

| 版本  | 日期       | 说明             |
| ----- | ---------- | ---------------- |
| 1.0.0 | 2025-09-22 | 首次定义组件规格 |
