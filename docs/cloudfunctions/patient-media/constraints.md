# 患者媒体与附件约束（patientMedia）

> 来源：cloudfunctions/patientMedia/index.js（基于源码提炼）。

## 约束综述
- 单文件大小：≤ 10MB（超过抛错 FILE_TOO_LARGE）
- TXT 在线预览：≤ 1MB（超过请使用下载）
- 配额：按患者维度维护计数与容量配额（在 `prepareUpload/completeUpload/delete` 中校验与更新）
- 去重：按文件内容 SHA-256 校验（completeUpload 阶段），重复文件抛错 `MEDIA_DUPLICATE`
- 鉴权：所有动作要求 `assertAuthorized` 通过（示例中需提供小程序端管理员上下文）
- URL：下载/预览使用临时链接，含过期时间（TTL 由服务端常量配置）
- 缩略图：图片在入库时生成 JPEG 缩略图（失败不阻塞上传）

## 动作与参数（节选）

| 动作 | 关键入参 | 返回 | 说明 |
| --- | --- | --- | --- |
| `summary` | `patientKey` | `{ totalCount, totalBytes, updatedAt }` | 当前配额快照 |
| `prepareUpload` | `patientKey, fileName, sizeBytes, mimeType?` | `cloudPath, fileUuid, uploadId, thumbPath?, quota` | 预检与配额校验 |
| `completeUpload` | `patientKey, fileUuid, fileID|fileId, fileName?, displayName?, storagePath?, category?, intakeId?` | `{ media, quota }` | 入库、生成缩略图、更新配额 |
| `list` | `patientKey` | `{ images[], documents[], quota }` | 列表（已过滤删除项） |
| `delete` | `mediaId` | `{ quota, deletedAt }` | 逻辑删除 + 云存储清理 |
| `download` | `mediaId` | `{ url, expiresAt }` | 下载链接（含 Content-Disposition） |
| `preview` | `mediaId, variant?` | `{ url, expiresAt }` | 图片预览（缩略图/原图） |
| `previewTxt` | `mediaId` | `{ content, length }` | TXT 在线预览（≤ 1MB） |
| `checkAccess` | - | `{ allowed, adminId }` | 鉴权探测 |
| `cleanupIntakeFiles` | `intakeId` | `{ deletedCount }` | 按入住记录批量清理 |

## 使用示例（上传）
```js
// 1) 预检获取云路径与 fileUuid
const prep = await wx.cloud.callFunction({
  name: 'patientMedia',
  data: { action: 'prepareUpload', patientKey, fileName: '检查报告.jpg', sizeBytes: file.size }
});

// 2) 将文件上传至 prep.result.data.cloudPath 后，调用 complete
await wx.cloud.callFunction({
  name: 'patientMedia',
  data: { action: 'completeUpload', patientKey, fileUuid: prep.result.data.fileUuid, fileID: tempFileId }
});
```

## 注意事项
- 建议前端在选择文件时先做类型与大小过滤，减少失败重试
- `displayName` 可在 completeUpload 时设置为用户友好名称
- 若需与入住条目关联，请传入 `intakeId`（用于 cleanupIntakeFiles）

