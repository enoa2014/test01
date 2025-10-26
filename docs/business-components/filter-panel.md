# FilterPanel 业务组件规范

## 组件简介

FilterPanel 提供多条件组合筛选，支持常用筛选快捷入口、动态添加条件、保存方案与状态同步，用于患者列表、报表等场景。

## 展示形态

- 默认作为侧边抽屉出现（桌面端 420px 宽，移动端全屏）。
- 顶部包含筛选概览与“重置/应用”按钮。
- 条件分组：基础条件、日期区间、状态与标签、高级条件。

## 属性

| 属性            | 类型    | 默认值  | 必填 | 说明                   |
| --------------- | ------- | ------- | ---- | ---------------------- |
| `value`         | Object  | `{}`    | 否   | 当前筛选值             |
| `schema`        | Array   | `[]`    | 是   | 条件定义，见下         |
| `visible`       | Boolean | `false` | 否   | 控制抽屉显隐           |
| `presets`       | Array   | `[]`    | 否   | 预设筛选方案           |
| `loading`       | Boolean | `false` | 否   | 是否正在加载方案或字段 |
| `error`         | String  | `''`    | 否   | 错误信息               |
| `maxConditions` | Number  | `10`    | 否   | 自定义条件上限         |
| `allowLogic`    | Boolean | `true`  | 否   | 是否开启 AND/OR 组合   |

### schema 格式

```json
[
  {
    "id": "status",
    "label": "患者状态",
    "type": "select",
    "options": [
      { "value": "in_care", "label": "在住" },
      { "value": "pending", "label": "待入住" }
    ],
    "multi": true,
    "default": []
  },
  {
    "id": "admitRange",
    "label": "入住日期",
    "type": "daterange",
    "default": []
  }
]
```

## 事件

| 事件名              | 参数              | 说明                      |
| ------------------- | ----------------- | ------------------------- |
| `bind:apply`        | `{ value }`       | 点击应用按钮              |
| `bind:reset`        | `{ presetId? }`   | 重置筛选（可带 presetId） |
| `bind:change`       | `{ value, diff }` | 任一字段变更              |
| `bind:savepreset`   | `{ name, value }` | 保存方案                  |
| `bind:deletepreset` | `{ presetId }`    | 删除方案                  |
| `bind:toggle`       | `{ visible }`     | 抽屉显隐变化              |

## API 对接

| 功能            | API                                       | 说明               |
| --------------- | ----------------------------------------- | ------------------ |
| 获取筛选 schema | `GET /api/filters/patient`                | 返回字段枚举与选项 |
| 获取预设方案    | `GET /api/filters/patient/presets`        | 用户/系统预设      |
| 保存方案        | `POST /api/filters/patient/presets`       | name + value       |
| 删除方案        | `DELETE /api/filters/patient/presets/:id` | -                  |

## 交互规则

1. 展开面板时展示当前筛选摘要，例如“状态：在住、待入住；入住日期：近 7 天”。
2. 多选标签以 `chips` 展示，可快速移除。
3. 当 `allowLogic` 为 true 时，支持条件块之间选择 `AND` / `OR`。
4. 超过 `maxConditions` 时，新增按钮置灰，显示“最多添加 X 条条件”。
5. 关闭面板时如有未保存修改，弹出确认对话框。
6. `loading` 时显示骨架屏，禁止操作按钮。

## 无障碍

- 使用 `aria-expanded` 标注折叠段。
- 条件列表使用 `role="group"`，便于屏幕阅读器理解。
- 提供键盘快捷键：`Ctrl+Enter` 应用，`Ctrl+Backspace` 重置。

## 性能

- schema 较大时按需渲染（虚拟节点）。
- 选项列表超过 50 项时启用搜索。
- 预设方案缓存到本地，减少重复请求。

## 测试用例

- schema 渲染、默认值、动态选项更新。
- 保存、删除预设方案的成功/失败场景。
- AND/OR 逻辑组合正确生成查询条件。
- 超过 `maxConditions` 限制的提示。
- 抽屉显隐、键盘操作。

## 版本记录

| 版本  | 日期       | 说明             |
| ----- | ---------- | ---------------- |
| 1.0.0 | 2025-09-22 | 首次定义组件规范 |
