# 页面说明：入住向导（/pages/patient-intake/*）

- 作用：分步录入患者档案信息并创建/更新入住记录。
- 组件：pm-input、pm-picker、pm-dialog、pm-badge（等）
- 数据：`patientIntake` 云函数（createPatient/updatePatient/saveDraft/getDraft/submit/updateIntakeRecord/checkoutPatient 等）。

## 步骤结构
- 基础信息 → 联系人/地址 → 情况说明 → 附件（可选）→ 核对提交

## 数据流
- 创建：`wx.cloud.callFunction({ name: 'patientIntake', data: { action: 'createPatient', formData } })`
- 草稿：`saveDraft/getDraft`，草稿 TTL/清理参考服务文档
- 更新：`updatePatient` / 记录：`updateIntakeRecord` / 离开：`checkoutPatient`

## 交互要点
- 表单字段校验与错误提示
- 草稿自动保存与恢复
- 身份证解析（可选逻辑）与手动修正

## 关联文档
- 云函数：../../cloudfunctions/patient-intake/form-validation.md、../../api-reference.md#patientintake
- UX：../../ux-analysis/patient-intake/optimization-plan.md

