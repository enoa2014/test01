# API 参考（云函数）— 草案

> 说明：云函数通过 `wx.cloud.callFunction` 调用。本文档统一动作（action）、请求与响应结构、错误码与示例。

## 约定
- 请求：`{ action: string, ...payload }`
- 响应：`{ ok: boolean, data?: any, error?: { code: string, message: string } }`
- 错误码：`INVALID_PARAM`、`NOT_FOUND`、`INTERNAL_ERROR`、`UNAUTHORIZED`

## patientProfile
- `action: 'list'`
  - 入参：`{ page?: number, pageSize?: number, forceRefresh?: boolean }`
  - 出参：`{ items: Patient[], total: number }`
- `action: 'detail'`
  - 入参：`{ key: string }`
  - 出参：`PatientDetail`

示例：
```js
wx.cloud.callFunction({ name: 'patientProfile', data: { action: 'list', pageSize: 20 } })
```

## readExcel
- `action: 'import'`：从云存储 Excel 导入至 `excel_records`
  - 入参：`{ fileId: string }`
  - 出参：`{ imported: number, table: string }`
- `action: 'syncPatients'`：从 `excel_records` 同步 `patients` 与 `patient_intake_records`
  - 入参：`{ batchId?: string }`
  - 出参：`{ patients: number, intakeRecords: number }`
- `action: 'test'`：解析测试

## patientIntake
- `action: 'create'`
  - 入参：`{ patientKey: string, date: string, hospital?: string, doctor?: string, diagnosis?: string }`
  - 出参：`{ _id: string }`
- `action: 'listByPatient'`
  - 入参：`{ patientKey: string }`
  - 出参：`{ items: IntakeRecord[] }`

## 统一错误处理
- 客户端：捕获 `res.result?.ok === false` 的场景，使用 `wx.showToast` 或 `pm-dialog` 展示错误信息
- 服务端：云函数抛错时，包装为 `{ ok: false, error: { code, message } }`

## 数据模型（简要）
详见：`./database-schema.md`

