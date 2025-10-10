# patientProfile 云函数

- 作用：面向前端的患者档案查询与导出服务。
- 缓存：列表使用 5 分钟缓存（`PATIENT_LIST_CACHE_TTL = 5 * 60 * 1000`），支持强制刷新。
- 数据源：`excel_records`、`excel_cache`、`patients`、`patient_intake_records`、`patient_media` 等集合。

## 动作（actions）

- `list`
  - 入参：`{ page?: number, pageSize?: number, includeTotal?: boolean, forceRefresh?: boolean }`
  - 出参：`{ success: true, patients: Patient[], totalCount?: number, hasMore: boolean, nextPage?: number }`
  - 说明：优先走缓存；当 `forceRefresh` 为 true 时刷新缓存。
- `detail`
  - 入参：`{ key: string }`
  - 出参：`{ success: true, patient: {...}, records?: [...], media?: {...} }`（字段以实现为准）
  - 说明：若主路径未命中，将回退到 `patients` 集合做兜底。
- `delete`
  - 入参：`{ patientKey?: string, recordKey?: string, operator?: string }`
  - 出参：`{ success: true, patientKey: string, removed: { patient, intakeRecords, excelRecords, mediaRecords, mediaFiles, mediaQuota } }`
  - 说明：包含媒体文件与配额、excel/intake 等关联数据删除与日志记录。
- `export`
  - 入参：`{ patientKeys?: string[], patientKey?: string, patientSnapshots?: { key/patientKey/recordKey,... }[] }`
  - 出参：`{ success: true, fileID: string, exported: number, missingKeys: string[] }`

## 错误格式

- 成功：`{ success: true, ... }`
- 失败：`{ success: false, error: { code, message, details? } }`

## 示例

```js
// 列表
wx.cloud.callFunction({ name: 'patientProfile', data: { action: 'list', pageSize: 20 } });
// 详情
wx.cloud.callFunction({ name: 'patientProfile', data: { action: 'detail', key: 'patient_key' } });
// 导出
wx.cloud.callFunction({ name: 'patientProfile', data: { action: 'export', patientKeys: ['k1','k2'] } });
```

## 参考
- 上层概览：../../cloud-function-architecture.md
- 关联：../patient-service/README.md

