# API 参考（云函数）— 草案

> 说明：云函数通过 `wx.cloud.callFunction` 调用。本文档统一动作（action）、请求与响应结构、错误码与示例。

## 约定
- 请求：`{ action: string, ...payload }`
- 响应：`{ success: boolean, ...data | error?: { code: string, message: string, details?: any } }`
- 错误码示例：`INVALID_PARAMS`、`PATIENT_NOT_FOUND`、`UNSUPPORTED_ACTION`、`INTERNAL_ERROR`

## patientProfile
- `action: 'list'`
  - 入参：`{ page?: number, pageSize?: number, includeTotal?: boolean, forceRefresh?: boolean }`
  - 出参：`{ success: true, patients: Patient[], totalCount: number, hasMore: boolean, nextPage?: number }`
  - 示例：
    ```js
    // 请求
    wx.cloud.callFunction({ name: 'patientProfile', data: { action: 'list', page: 0, pageSize: 20, includeTotal: true } })
    // 返回（节选）
    {
      success: true,
      patients: [{ patientName: '张三', admissionCount: 3, latestAdmissionTimestamp: 1758326400000, latestDiagnosis: '急性支气管炎', latestHospital: '北京儿童医院' }],
      totalCount: 69, hasMore: true, nextPage: 1
    }
    ```
- `action: 'detail'`
  - 入参：`{ key: string }`
  - 出参：`{ success: true, patient: {...}, records: [...], ... }`（详情含最新聚合字段，如 `latestAdmissionTimestamp`）
  - 示例：
    ```js
    wx.cloud.callFunction({ name: 'patientProfile', data: { action: 'detail', key: 'ZhangSan-2010-01-01-M' } })
    // 返回（节选）
    { success: true, patient: { patientName: '张三', admissionCount: 3 }, records: [{ hospital: '北京儿童医院', diagnosis: '...' }] }
    ```
- `action: 'delete'`
  - 入参：`{ patientKey?: string, recordKey?: string, operator?: string }`（二选一提供标识）
  - 出参：`{ success: true, patientKey: string, removed: { patient, intakeRecords, excelRecords, mediaRecords, mediaFiles, mediaQuota } }`
- `action: 'export'`
  - 入参：`{ patientKeys?: string[], patientKey?: string, patientSnapshots?: { key/patientKey/recordKey,... }[] }`
  - 出参：`{ success: true, fileID: string, exported: number, missingKeys: string[] }`（云存储 xlsx 文件）
  - 示例：
    ```js
    // 批量导出
    wx.cloud.callFunction({ name: 'patientProfile', data: { action: 'export', patientKeys: ['key1','key2'] } })
    // 返回
    { success: true, fileID: 'cloud://.../patient-report-...xlsx', exported: 12, missingKeys: [] }
    ```

示例：
```js
wx.cloud.callFunction({ name: 'patientProfile', data: { action: 'list', pageSize: 20 } })
```

## readExcel
- `action: 'import'`：从云存储 Excel 导入，生成缓存并同步患者
  - 入参：`{ fileId?: string }`（同义：`fileID`/`excelFileId`）
  - 出参：`{ action: 'import', sheetName, imported, totalPatients, sync }`
- `action: 'syncPatients'`：从 `excel_records` 重新计算并同步
  - 入参：`{ syncBatchId?: string }`
  - 出参：`{ action: 'syncPatients', totalPatients, sync }`
- `action: 'normalizeFromRaw'`：从 `excel_raw_records` 归一化导入并同步
  - 入参：`{ syncBatchId?: string }`
  - 出参：`{ action: 'normalizeFromRaw', imported, totalPatients, sync, aggregateRefresh }`
- `action: 'resetAll'`（或 `reset`）：清空患者相关集合与操作日志
  - 入参：`{}`
  - 出参：`{ action: 'resetAll', success: true, cleared: {...}, timestamp }`
- `action: 'test'`：解析测试
  - 入参：`{ fileId?: string }`
  - 出参：`{ action: 'test', sheetName, headerCount, recordCount, patientCount, sampleRecords, samplePatients }`

## patientIntake
- `getPatients`：患者列表（选择用）
  - 入参：`{ searchKeyword?: string, page?: number, pageSize?: number }`
  - 出参：`{ success: true, data: { patients: [...], hasMore: boolean } }`
- `getPatientDetail`：患者详情（含聚合同步）
  - 入参：`{ patientKey: string, recordKey?: string, patientName?: string }`
  - 出参：`{ success: true, data: {...} }`
- `listIntakeRecords`：患者的入住记录列表
  - 入参：`{ patientKey: string }`
  - 出参：`{ success: true, data: { items: IntakeRecord[] } }`
- `createPatient`：创建患者（表单）
  - 入参：`{ formData: {...见源码必填校验...} }`
  - 出参：`{ success: true, data: { patientKey, intakeId? } }`
- `saveDraft`：保存草稿
  - 入参：`{ draftId?: string, formData: {...} }`
  - 出参：`{ success: true, data: { draftId, expiresAt } }`
- `getDraft`：获取草稿
  - 入参：`{ draftId: string }`
  - 出参：`{ success: true, data: { formData, expiresAt } }`
- `submit`：提交入住（表单）
  - 入参：`{ formData: {...} }`
  - 出参：`{ success: true, data: { patientKey, intakeId } }`
- `updatePatient`：更新患者（编辑资料）
  - 入参：`{ patientKey: string, formData: {...}, audit?: { operatorId?, operatorName?, message?, extra? } }`
  - 出参：`{ success: true, data: { patientUpdated: boolean, intakeUpdated: boolean, updatedAt } }`
- `updateIntakeRecord`：新增/更新入住条目
  - 入参（部分）：`{ patientKey: string, intakeId?: string, intakeTime?: number, checkoutAt?: number, hospital?, diagnosis?, doctor?, ... }`
  - 出参：`{ success: true, data: { intakeId, intakeTime, checkoutAt?, admissionCount?, latestAdmissionDate? } }`
- `deleteIntakeRecord`：删除入住条目
  - 入参：`{ patientKey: string, intakeId: string }`
- `checkoutPatient`：办理离开
  - 入参：`{ patientKey: string, checkout: { reason?: string, note?: string, operatorId?: string, operatorName?: string, timestamp?: number } }`
- `updateCareStatus`：手动调整住户状态
  - 入参：`{ patientKey: string, careStatus: 'in_care'|'pending'|'discharged', note?: string, operatorId?: string, operatorName?: string }`
- `getConfig`：入住配置
  - 入参：`{}`；出参包含 `situationConfig` 与 `uploadConfig`
- `cleanupDrafts`：清理过期草稿
  - 入参：`{}`；出参包含 `deletedCount`
- `syncFromExcel`：调用 readExcel 同步
  - 入参：`{ syncBatchId?: string, forceRefresh?: boolean }`
## patientMedia（附件/媒体）
- 动作：`summary`、`prepareUpload`、`completeUpload`、`list`、`delete`、`download`、`preview`、`previewTxt`、`checkAccess`、`cleanupIntakeFiles`

### summary
- 入参：`{ patientKey: string }`
- 出参：`{ success: true, data: { totalCount: number, totalBytes: number, updatedAt: number } }`

### prepareUpload（预检与配额校验）
- 入参：`{ patientKey: string, fileName: string, sizeBytes: number, mimeType?: string, fileUuid?: string }`
- 校验：单文件 ≤ 10MB，配额剩余数量/容量充足
- 出参（节选）：
  - `data.cloudPath`/`storagePath`：建议的云路径
  - `data.fileUuid`、`data.uploadId`：本次上传标识
  - `data.thumbPath`（图片）与 `data.quota`（配额摘要）

### completeUpload（入库与生成缩略图）
- 入参：`{ patientKey: string, fileUuid: string, fileId|fileID: string, fileName?: string, displayName?: string, storagePath?: string, category?: string, intakeId?: string }`
- 逻辑：校验空文件/大小/重复（hash 去重）；图片生成缩略图；入库并更新配额
- 出参：`{ success: true, data: { media: Media, quota } }`

### list（按患者列出媒体）
- 入参：`{ patientKey: string }`
- 出参：`{ success: true, data: { images: Media[], documents: Media[], quota } }`

### delete（删除单个媒体）
- 入参：`{ mediaId: string }`
- 出参：`{ success: true, data: { quota, deletedAt } }`

### download（生成带 Content-Disposition 的下载链接）
- 入参：`{ mediaId: string }`
- 出参：`{ success: true, data: { url: string, expiresAt: number } }`

### preview（图片预览）
- 入参：`{ mediaId: string, variant?: 'thumb'|'origin' }`
- 出参：`{ success: true, data: { url: string, expiresAt: number } }`

### previewTxt（TXT 在线预览）
- 入参：`{ mediaId: string }`
- 限制：文件 ≤ 1MB 且 `mimeType === 'text/plain'`
- 出参：`{ success: true, data: { content: string, length: number } }`

### checkAccess（鉴权探测）
- 入参：`{}`（需具备相应权限）
- 出参：`{ success: true, data: { allowed: true, adminId } }`

### cleanupIntakeFiles（按入住记录批量清理）
- 入参：`{ intakeId: string }`
- 出参：`{ success: true, data: { deletedCount: number } }`

示例：
```js
// 预检与上传
const prep = await wx.cloud.callFunction({
  name: 'patientMedia',
  data: { action: 'prepareUpload', patientKey, fileName, sizeBytes }
});
// 上传至 prep.result.data.cloudPath 后，调用 complete
await wx.cloud.callFunction({
  name: 'patientMedia',
  data: { action: 'completeUpload', patientKey, fileUuid: prep.result.data.fileUuid, fileID }
});
```

## patientService（聚合服务）
- 说明：代理到 `patientProfile` 并扩展 `fullDetail`
- 动作：`detail` / `fullDetail`（内部调用 `handleGetPatientFullDetail`）、`list`、`delete`

## 统一错误处理
- 客户端：检测 `res.result?.success === false`，使用 `wx.showToast` 或 `pm-dialog` 展示 `error.message`
- 服务端：抛错统一包装 `{ success: false, error: { code, message, details? } }`

### 常见错误码（patientProfile 节选）
- `UNSUPPORTED_ACTION`：未支持的操作
- `LIST_FAILED`：列表加载失败
- `DETAIL_FAILED`：详情加载失败
- `INVALID_PATIENT_KEY` / `PATIENT_NOT_FOUND`：无效或不存在的住户标识
- `DELETE_PATIENT_FAILED`：删除住户档案失败
- `EXPORT_NO_KEYS`：导出时未提供任何住户 key
- `EXPORT_NO_DATA`：未找到可导出的档案
- `EXPORT_TEMPLATE_MISSING` / `EXPORT_TEMPLATE_INVALID`：导出模板缺失或无效
- `EXPORT_UPLOAD_FAILED`：导出文件上传失败

## 数据模型（简要）
详见：`./database-schema.md`
