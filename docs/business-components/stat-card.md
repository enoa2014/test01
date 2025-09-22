# StatCard 业务组件规范

## 组件简介
StatCard 用于展示关键指标、同比/环比趋势、图表概览，是仪表盘与详情页的核心数据展示组件。支持纯数字、图表嵌入、趋势箭头、告警标记。

## 组件形态
- **基础型**：标题 + 主指标 + 描述。
- **趋势型**：主指标 + 趋势百分比 + 图形（折线/柱状微图）。
- **对比型**：两组指标并排展示。
- **告警型**：顶部显示告警信息或风险提示。

## 属性
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `title` | String | `''` | 指标名称 |
| `value` | Number/String | `0` | 主指标值，可格式化 |
| `unit` | String | `''` | 单位，如 `人`、`%` |
| `delta` | Number | `0` | 环比/同比变化值 |
| `deltaType` | String | `percentage` | `percentage` / `absolute` |
| `deltaTrend` | String | 自动 | `up` / `down` / `flat` |
| `chart` | Object | `null` | 嵌入图表配置（见下） |
| `comparison` | Array | `[]` | 对比数据，包含 label/value |
| `status` | String | `normal` | `normal` / `warning` / `critical` |
| `loading` | Boolean | `false` | 加载态 |
| `tooltip` | String | `''` | 提示内容 |
| `link` | String | `''` | 跳转链接 |

### chart 配置示例
```json
{
  "type": "sparkline",
  "data": [10, 15, 20, 18, 25, 30],
  "color": "var(--color-primary)"
}
```

## 事件
| 事件名 | 参数 | 说明 |
|--------|------|------|
| `bind:tap` | `{ link }` | 点击卡片 |
| `bind:charttap` | `{ index, value }` | 点击图表节点 |
| `bind:tooltip` | `{ visible }` | 悬浮提示显隐（桌面端） |

## 数据来源
- `/api/dashboard/stats`：返回主指标与 delta。
- `/api/dashboard/trends`：返回图表数据。
- `/api/dashboard/alerts`：返回告警状态及提示。

## 展示规则
- `deltaTrend` 若未指定，根据 `delta` 正负自动推断。
- 当 `status !== 'normal'` 时，标题左侧显示对应颜色的图标。
- `comparison` 数组长度限制 2，超过时转换为 tooltip 展示。
- `loading` 时使用骨架屏替代内容，并禁用点击事件。

## 无障碍与国际化
- 提供 `aria-label="指标名称：值，环比 +5%"`。
- 数值格式化需遵循本地化规则，可通过 util `formatNumber` 实现。
- 对于色盲用户，趋势箭头需配合 `+/-` 文案。

## 性能
- 图表部分采用轻量 sparklines（自绘或 canvas）。
- 避免在组件内直接请求数据，由父级传入。
- 支持懒加载：当组件进入 viewport 时再渲染图表。

## 测试清单
- 渲染不同 `status`、`deltaTrend`、`chart.type`。
- 交互事件：点击卡片、图表节点、tooltip。
- 格式化：大数（千分位）、百分比。
- loading/empty/error 状态。

## 版本记录
| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2025-09-22 | 首次定义规范 |
