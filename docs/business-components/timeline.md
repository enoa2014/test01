# Timeline 业务组件规范

## 组件简介

Timeline 组件用于呈现患者及相关事件的时间序列记录，支持按类型过滤、按日期分组、展开详情及操作入口。适用于患者详情页、任务跟踪及运营日志。

## 结构

```
<timeline>
  ├─ Header（日期或分组标题）
  ├─ Item 列表
  │   ├─ Icon/Type 标识
  │   ├─ Title + 摘要
  │   ├─ Metadata（时间、责任人、来源）
  │   └─ Actions（查看、编辑、提醒、跳转）
  └─ LoadMore / Paging
</timeline>
```

## 属性

| 属性           | 类型    | 默认值         | 说明                               |
| -------------- | ------- | -------------- | ---------------------------------- |
| `items`        | Array   | `[]`           | 时间线数据（详见下文）             |
| `groupBy`      | String  | `date`         | 分组方式：`date` / `type` / `none` |
| `filters`      | Array   | `[]`           | 类型筛选配置                       |
| `loading`      | Boolean | `false`        | 是否处于加载状态                   |
| `pageable`     | Boolean | `false`        | 是否启用分页/加载更多              |
| `hasMore`      | Boolean | `false`        | 是否还有更多数据                   |
| `virtual`      | Boolean | `false`        | 是否使用虚拟列表提高性能           |
| `highlightIds` | Array   | `[]`           | 高亮事件 ID 列表                   |
| `emptyText`    | String  | `暂无事件记录` | 空状态文案                         |

### items 数据结构

```json
[
  {
    "id": "evt_001",
    "type": "care",
    "title": "每日巡房完成",
    "summary": "血压 120/80，精神状态良好",
    "timestamp": "2025-09-22T10:30:00+08:00",
    "actor": {
      "id": "nurse_01",
      "name": "王护士"
    },
    "source": "manual", // manual/system/api
    "status": "normal", // normal/warning/error
    "attachments": [{ "name": "巡房记录.pdf", "url": "..." }],
    "actions": [
      { "id": "view", "label": "查看详情" },
      { "id": "remind", "label": "提醒负责人" }
    ]
  }
]
```

## 事件

| 事件名              | 参数               | 说明         |
| ------------------- | ------------------ | ------------ |
| `bind:itemtap`      | `{ item }`         | 点击事件条目 |
| `bind:actiontap`    | `{ action, item }` | 操作按钮     |
| `bind:loadmore`     | `{ page }`         | 请求更多数据 |
| `bind:filterchange` | `{ filter }`       | 筛选变更     |

## 接口依赖

| API                                         | 用途         | 查询参数                                    |
| ------------------------------------------- | ------------ | ------------------------------------------- |
| `GET /api/patients/:id/timeline`            | 获取事件列表 | `page`、`pageSize`、`types[]`、`from`、`to` |
| `POST /api/patients/:id/timeline`           | 新增事件     | -                                           |
| `PATCH /api/patients/:id/timeline/:eventId` | 更新事件     | -                                           |

## 交互规则

1. 默认按日期降序排列，同一天的事件分组显示。
2. 长文本摘要超过 2 行时折叠，提供“展开全部”。
3. 高亮事件（`highlightIds`）在列表中置顶，并显示彩色边框。
4. `pageable` 为 true 时，底部显示“加载更多”按钮或无限滚动触发。
5. `filters` 支持多选，选择变更后组件触发 `filterchange` 并重置分页。

## 无障碍要求

- 列表容器使用 `role="list"`，项使用 `role="listitem"`。
- 提供隐藏文本（SR only）描述事件类型、来源与状态。
- 键盘支持上下箭头导航，Enter 打开详情，Space 执行默认操作。

## 性能优化

- 大量数据时启用虚拟滚动（`virtual=true`）。
- 分页请求，建议每页不超过 20 条。
- 对附件点击采用懒加载或预览功能。

## 测试清单

- 分组与排序正确性。
- 过滤条件切换、无数据状态。
- 操作按钮调用、事件参数。
- 加载更多：成功、失败、无更多。
- 高亮与提醒逻辑。

## 版本记录

| 版本  | 日期       | 说明     |
| ----- | ---------- | -------- |
| 1.0.0 | 2025-09-22 | 首版规范 |
