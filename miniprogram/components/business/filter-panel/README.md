# FilterPanel 业务组件

患者列表页高级筛选抽屉组件，支持组合筛选患者状态、风险等级、时间范围、诊断类型以及医院来源。

## 属性

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `visible` | Boolean | `false` | 是否显示筛选面板 |
| `closeOnOverlay` | Boolean | `true` | 点击遮罩是否关闭面板 |
| `statuses` | Array<{ id, label }> | 见源码 | 患者状态选项列表 |
| `riskLevels` | Array<{ id, label }> | 见源码 | 风险等级选项 |
| `diagnosisOptions` | Array<{ id, label }> | 见源码 | 常用诊断建议列表 |
| `hospitalOptions` | Array<{ id, label }> | 见源码 | 医院筛选选项 |
| `value` | Object | `{ statuses: [], riskLevels: [], diagnosis: [], hospitals: [], dateRange: { start: '', end: '' }, logicMode: 'AND' }` | 初始选中值 |
| `previewCount` | Number | `-1` | 预览数量（由父级实时传入） |
| `previewLabel` | String | `名患者符合筛选` | 预览数量描述文本 |
| `previewLoading` | Boolean | `false` | 是否显示“计算中”状态 |
| `schemes` | Array<{ id, name, summary }> | `[]` | 已保存筛选方案列表 |

## 事件

| 事件 | detail | 说明 |
| --- | --- | --- |
| `change` | `{ source, value }` | 任一筛选项变更时触发，`source` 标识来源（status/risk/hospital/date/diagnosis/reset/logic） |
| `preview` | `{ value, activeFilters, logicMode }` | 每次变更后触发，返回当前条件与激活项，便于父级实时预览 |
| `apply` | `{ value }` | 点击“应用筛选”按钮触发 |
| `reset` | `{}` | 点击“重置”按钮触发 |
| `close` | `{}` | 点击关闭按钮或遮罩触发 |
| `savescheme` | `{}` | 点击“保存方案”按钮触发 |
| `appliescheme` | `{ id }` | 点击已保存方案的“应用”按钮触发 |
| `deletescheme` | `{ id }` | 点击已保存方案的“删除”按钮触发 |
| `renamescheme` | `{ id }` | 点击已保存方案的“重命名”按钮触发 |
| `searchdiagnosis` | `{ keyword }` | 诊断关键字输入（200ms 防抖） |
| `diagnosisselect` | `{ id, label }` | 选择建议诊断时触发 |

## 使用示例

```xml
<filter-panel
  visible="{{filterVisible}}"
  statuses="{{statusFilters}}"
  risk-levels="{{riskFilters}}"
  hospital-options="{{hospitalFilters}}"
  diagnosis-options="{{diagnosisOptions}}"
  value="{{currentFilters}}"
  preview-count="{{preview.count}}"
  preview-loading="{{preview.loading}}"
  schemes="{{filterSchemes}}"
  bind:preview="onFilterPreview"
  bind:apply="onFilterApply"
  bind:reset="onFilterReset"
  bind:savescheme="onFilterSave"
  bind:appliescheme="onFilterApplyScheme"
  bind:deletescheme="onFilterDeleteScheme"
  bind:renamescheme="onFilterRenameScheme"
  bind:searchdiagnosis="onDiagnosisSearch"
  bind:diagnosisselect="onDiagnosisSelect"
/>
```

## 后续计划
- 结合后端数据源动态加载诊断、医院选项
- 支持 AND/OR 逻辑下的后端筛选与预览数量联动
- 提供筛选方案重命名与排序能力
