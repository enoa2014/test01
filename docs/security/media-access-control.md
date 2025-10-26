# 媒体访问控制（patientMedia）

- 目标：明确患者媒体文件（图片/文档）上传、下载、预览与清理的安全策略。

## 鉴权
- `sessionToken`：通过 `event.sessionToken` 传入；服务端以 `PATIENT_MEDIA_ALLOW_DEV_BYPASS` 控制开发可放宽。
- 生产建议：关闭 bypass，要求合法 token；结合管理员/角色控制。

## 上传流程
- 预检：`prepareUpload` 校验配额（数量/容量）、文件大小（≤10MB）、类型（JPG/PNG/WebP/TXT/PDF/Word/Excel）。
- 入库：`completeUpload` 执行 hash 去重、缩略图生成（图片），更新配额，关联 `patientKey`/`intakeId`（可选）。

## 下载与预览
- `download`：生成临时 URL，附加 `Content-Disposition`（文件名编码，防止中文乱码）。
- `preview`：图片预览（thumb/origin）；`previewTxt`：TXT 在线预览（≤1MB）。
- 过期：临时 URL 具有 TTL（实现中为 300s）。

## 清理
- `delete`：逻辑删除并清理云存储文件；返回更新后的配额摘要。
- `cleanupIntakeFiles`：按入住记录批量清理；用于撤销/删除流程。

## 参考
- 云函数：../../cloudfunctions/patient-media/constraints.md
- 代码：cloudfunctions/patientMedia/index.js

