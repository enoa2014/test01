# PatientCard 业务组件

用于患者列表/卡片视图的统一展示组件，封装头像、徽章、快捷操作、批量选择等交互。

## 属性

| 属性名 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `patient` | `Object` | `{}` | 患者数据对象，内置字段：`name`、`patientName`、`ageText`、`latestEvent` 等 |
| `mode` | `String` | `compact` | 展示模式：`list` / `compact` / `detail`，影响外观与间距 |
| `selectable` | `Boolean` | `false` | 是否显示多选控件 |
| `selected` | `Boolean` | `false` | 当前卡片是否已选中 |
| `badges` | `Array` | `[]` | 徽章数组，每项 `{ text, type }`，`type` 对应 `pm-badge` 的语义色 |
| `actions` | `Array` | `[]` | 快捷操作按钮数组，每项 `{ id, label, icon, type }` |
| `clickable` | `Boolean` | `true` | 是否允许点击卡片触发 `cardtap` |
| `status` | `String` | `default` | 透传 `pm-card` 的 `status`，用于状态色条 |

## 事件

| 事件名 | 说明 |
| --- | --- |
| `cardtap` | 点击卡片触发，`detail.patient` 返回患者对象 |
| `actiontap` | 点击底部操作按钮触发，`detail.action`、`detail.patient` 可用 |
| `selectchange` | 勾选状态切换事件，`detail.selected` 表示新状态 |
| `longpress` | 长按卡片触发（移动端） |

## 使用示例

```xml
<patient-card
  patient="{{item}}"
  mode="compact"
  badges="{{item.badges}}"
  actions="{{cardActions}}"
  status="{{item.cardStatus}}"
  bind:cardtap="onPatientTap"
  bind:actiontap="onCardAction"
  bind:selectchange="onSelectChange"
/>
```

组件依赖 `pm-card`、`pm-badge`、`pm-button`，使用前请确认对应基础组件已注册。
