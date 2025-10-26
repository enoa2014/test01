# 页面说明：主页/住户列表（/pages/index）

- 作用：展示住户列表与搜索筛选入口。
- 组件：SmartSearchBar、FilterPanel、PatientCard、StatusTag、LoadingSpinner
- 数据：优先调用 `patientProfile.list`（必要时可通过 `patientService` 拓展）。

## 数据流
- 输入：搜索关键字、筛选方案、本地历史
- 请求：`wx.cloud.callFunction({ name: 'patientProfile', data: { action: 'list', page, pageSize } })`
- 输出：卡片列表、分页/加载态

## 交互要点
- 搜索建议与历史（SmartSearchBar）
- 筛选方案（FilterPanel）
- 批量选择与卡片操作（PatientCard）

## 关联文档
- 组件：../../business-components/patient-card.md、../../business-components/smart-search-bar.md、../../business-components/filter-panel.md
- 云函数：../../cloudfunctions/patient-profile/README.md

