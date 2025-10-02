# SmartSearchBar 业务组件

用于患者列表页的智能搜索栏，包括搜索输入、防抖、建议、快捷筛选与历史记录。

## 属性

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `value` | String | `''` | 当前搜索关键词（受控） |
| `placeholder` | String | `搜索患者姓名/病历号/诊断标签` | 输入框占位符 |
| `suggestions` | Array | `[]` | 搜索建议列表（最多展示 8 条） |
| `filters` | Array | `[]` | 快速筛选 chips，结构 `{ id, label, active }` |
| `loading` | Boolean | `false` | 是否显示“正在加载…”提示 |
| `historyEnabled` | Boolean | `true` | 是否保存/展示搜索历史 |
| `debounce` | Number | `300` | 输入防抖时长（毫秒） |

## 事件

| 事件 | detail | 说明 |
| --- | --- | --- |
| `input` | `{ value }` | 经防抖后的输入回调 |
| `suggest` | `{ value, source: 'input' }` | 输入防抖触发的建议请求 |
| `search` | `{ value, source }` | 提交搜索（button/suggestion/history/confirm） |
| `clear` | `{}` | 清空输入时触发 |
| `filtertap` | `{ filter }` | 点击快捷筛选项 |
| `toggleadv` | `{}` | 打开高级筛选入口 |

## 历史记录
- 存储键：`smart_search_history`
- 最多保留 10 条记录
- 点击建议/历史会自动保存

## TODO
- 渲染建议时支持富文本高亮
- 增加搜索历史无数据占位
- 编写单元测试覆盖防抖、历史管理等逻辑
