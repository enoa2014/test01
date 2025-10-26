# readExcel 云函数

- 作用：Excel 数据导入、归一化与同步，提供重置与测试动作。
- 代码位置：`cloudfunctions/readExcel/index.js`
- 依赖环境变量：`EXCEL_FILE_ID`（云存储文件 ID）

## 动作（actions）

- `import`
  - 入参：`{ fileId?: string }`（同义：`fileID`/`excelFileId`）
  - 出参：`{ action: 'import', sheetName, imported, totalPatients, sync }`
  - 说明：下载 Excel → 解析 → 导入 `excel_records` → 同步至 `patients`，并写入缓存。
- `syncPatients`
  - 入参：`{ syncBatchId?: string }`
  - 出参：`{ action: 'syncPatients', totalPatients, sync }`
  - 说明：以数据库内 `excel_records` 为来源重新同步。
- `normalizeFromRaw`
  - 入参：`{ syncBatchId?: string }`
  - 出参：`{ action: 'normalizeFromRaw', imported, totalPatients, sync, aggregateRefresh }`
  - 说明：从 `excel_raw_records` 归一化生成 `excel_records` 并同步；会重置目标集合。
- `resetAll` / `reset`
  - 入参：`{}`
  - 出参：`{ action: 'resetAll', success: true, cleared: {...}, timestamp }`
  - 说明：清空 `patients`、`patient_intake_records`、`excel_cache` 与操作日志（Danger）。
- `test`
  - 入参：`{ fileId?: string }`
  - 出参：`{ action: 'test', sheetName, headerCount, recordCount, patientCount, sampleRecords, samplePatients }`

## 使用示例

```js
await wx.cloud.callFunction({ name: 'readExcel', data: { action: 'import', fileId: 'cloud://...' } });
await wx.cloud.callFunction({ name: 'readExcel', data: { action: 'syncPatients' } });
```

## 注意事项

- 建议先在测试环境验证 `import/normalizeFromRaw`，再在生产执行。
- `resetAll` 为破坏性操作，务必先备份（参见 scripts 或 `database:backup`）。
- `EXCEL_FILE_ID` 未配置时 `import/test` 将失败。

## 参考
- 上层概览：../../cloud-function-architecture.md

