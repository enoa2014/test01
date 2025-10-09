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
- `action: 'detail'`
  - 入参：`{ key: string }`
  - 出参：`{ success: true, patient: {...}, records: [...], ... }`（详情含最新聚合字段，如 `latestAdmissionTimestamp`）
- `action: 'delete'`
  - 入参：`{ patientKey?: string, recordKey?: string, operator?: string }`（二选一提供标识）
  - 出参：`{ success: true, patientKey: string, removed: { patient, intakeRecords, excelRecords, mediaRecords, mediaFiles, mediaQuota } }`
- `action: 'export'`
  - 入参：`{ patientKeys?: string[], patientKey?: string, patientSnapshots?: { key/patientKey/recordKey,... }[] }`
  - 出参：`{ success: true, fileID: string, exported: number, missingKeys: string[] }`（云存储 xlsx 文件）

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
- `saveDraft`/`getDraft`：草稿保存/获取
- `submit`：提交入住（表单）
- `updatePatient`：更新患者（编辑资料）
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
- `cleanupDrafts`：清理过期草稿
- `syncFromExcel`：调用 readExcel 同步
## patientMedia（附件/媒体）
- 动作：`summary`、`prepareUpload`、`completeUpload`、`list`、`delete`、`download`、`preview`、`previewTxt`、`checkAccess`、`cleanupIntakeFiles`
- 典型入参：`{ patientKey, type?: 'image'|'doc', fileId?, mediaId?, uploadToken?... }`
- 返回：各动作返回对应的列表、访问令牌、或操作结果；详情见源码 `cloudfunctions/patientMedia/index.js`

## patientService（聚合服务）
- 说明：代理到 `patientProfile` 并扩展 `fullDetail`
- 动作：`detail` / `fullDetail`（内部调用 `handleGetPatientFullDetail`）、`list`、`delete`

## 统一错误处理
- 客户端：检测 `res.result?.success === false`，使用 `wx.showToast` 或 `pm-dialog` 展示 `error.message`
- 服务端：抛错统一包装 `{ success: false, error: { code, message, details? } }`

## 数据模型（简要）
详见：`./database-schema.md`
