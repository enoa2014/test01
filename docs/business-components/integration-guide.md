# 业务组件与 API 集成指南

## 目标

- 明确前端业务组件与后端接口的交互流程、数据适配与错误处理策略。
- 指导工程师将 PatientCard、PatientForm、SmartSearchBar、FilterPanel、PM-Card、Timeline 组件集成到实际页面。

## 集成步骤总览

1. **数据模型初始化**：通过 API 获取基础数据（患者列表、筛选 schema、统计指标）。
2. **组件装配**：在页面 `usingComponents` 中注册业务组件，传入对应属性。
3. **事件监听**：在页面逻辑中监听组件事件（如 `search`、`apply`、`submit`），调用 API 并更新状态。
4. **状态管理**：建议使用轻量 store（如 `behavior` + 全局 event channel）或 page-level 数据管理。
5. **错误与重试**：使用统一错误处理工具，将 API 错误映射到组件的 `error` 或 `toast`。
6. **缓存与优化**：为搜索、筛选、指标等接口引入缓存策略。

## 页面示例

### 患者列表页

1. 页面加载：
   - 请求 `/api/v1/filters/patient/schema`、`/api/v1/filters/patient/presets`
   - 请求 `/api/v1/patients` 获取初始列表
2. 将结果传入组件：
   ```js
   this.setData({
     filtersSchema: resSchema.data,
     presets: resPresets.data,
     patients: resPatients.data.list,
   });
   ```
3. 事件响应：
   - `smart-search-bar` 的 `bind:search` → 调用 `/api/v1/search/patients` 或刷新列表
   - `filter-panel` 的 `bind:apply` → 重新请求列表
   - `patient-card` 的 `bind:cardtap` → 跳转详情

### 患者详情页

1. 获取 `/api/v1/patients/:id` 填充 `patient-form`
2. 渲染 `timeline`：调用 `/api/v1/patients/:id/timeline`
3. 监听表单 `submit`：调用 `PUT /api/v1/patients/:id`
4. 监听时间线 `loadmore`：分页加载数据

### 仪表盘页

1. 并行请求 `/api/v1/dashboard/stats`、`/api/v1/dashboard/trends`
2. 将数据映射到 `pm-card` 列表（`variant="stat"` / `status` 组合）
   ```wxml
   <pm-card
     wx:for="{{statCards}}"
     wx:key="id"
     variant="stat"
     status="{{item.status}}"
     title="{{item.title}}"
     value="{{item.value}}"
     trend="{{item.trend}}"
     bind:tap="onStatTap"
     data-id="{{item.id}}"
   />
   ```
   ```js
   this.setData({
     statCards: mapStatsToPmCard(statsResponse.data),
   });
   ```
3. 监听 `pm-card` 的 `tap` 或自定义事件执行跳转/分析

## 数据适配建议

- 使用 util 函数 `mapPatientToCard(patient)`、`mapStatsToPmCard(stats)`，减少页面逻辑重复（示例实现见 `utils/mappers/dashboard.js`）。
- 对缺失字段提供默认值，避免组件渲染错误。
- 使用 `dayjs` 或类似库处理时间展示。

## 错误处理策略

| 场景        | 组件表现                    | 页面处理               |
| ----------- | --------------------------- | ---------------------- |
| API 400/409 | 表单字段高亮 + `error` 提示 | 聚焦到出错字段         |
| API 401/403 | 全局 Toast + 跳转登录       | 引导重新认证           |
| API 404     | 列表显示空状态              | 提供返回按钮           |
| 网络异常    | 组件切换 `error` 状态       | 提供“重试”按钮重新请求 |

## Loading 与 Skeleton

- 搜索、筛选、列表刷新时启用页面级 loading（`wx.showLoading`）。
- 组件内部使用骨架屏（如 `patient-card`、`pm-card`）。
- 避免重复 loading，使用全局请求计数器管理。

## 缓存策略

| 数据        | 缓存方式 | 失效策略            |
| ----------- | -------- | ------------------- |
| 搜索建议    | 内存缓存 | 5 分钟              |
| 筛选 schema | 本地存储 | 24 小时或版本号变更 |
| 仪表盘指标  | 内存缓存 | 60 秒               |
| 患者详情    | 页面缓存 | 离开页面即清理      |

## 日志与埋点

- 记录组件关键操作（搜索、筛选、表单提交）用于分析：`POST /api/v1/audit/logs`。
- 埋点字段建议：`event`, `component`, `patientId`, `filters`, `duration`。

## 集成清单

- [ ] 页面已注册业务组件 `usingComponents`
- [ ] API 路径、参数与数据模型符合 `docs/api/business-components.md`
- [ ] 错误码映射至组件状态
- [ ] 添加必要的 loading、空状态、重试逻辑
- [ ] 补充单元/集成测试及模拟数据
- [ ] 文档与 README 更新（如何运行、如何调试）

## 后续步骤

- 在组件开发完成后，编写 `miniprogram/pages/example` 页面作为参考实现。
- 与后端联合调试时使用 `environment-config` 指向测试环境。
- 定期回顾组件与 API 协议，更新变更日志并通知团队。
