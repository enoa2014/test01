# 页面说明：患者详情（/pages/patient-detail）

- 作用：展示单个住户的基础信息、入住记录、媒体附件与操作日志条目概览。
- 组件：pm-card、pm-button、媒体列表/预览、时间线（可选）
- 数据：`patientProfile.detail`（或 `patientService.fullDetail`），媒体通过 `patientMedia`。

## 数据流
- 请求详情：`wx.cloud.callFunction({ name: 'patientProfile', data: { action: 'detail', key } })`
- 媒体列表：`wx.cloud.callFunction({ name: 'patientMedia', data: { action: 'list', patientKey } })`

## 交互要点
- 媒体：预检 → 入库（prepareUpload/completeUpload），删除/预览/下载
- 入住记录：使用 patientIntake 的 list/update/delete （视需求）

## 关联文档
- 云函数：../../cloudfunctions/patient-profile/README.md、../../cloudfunctions/patient-service/README.md、../../cloudfunctions/patient-media/constraints.md

