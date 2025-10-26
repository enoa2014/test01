# 住户列表 Excel 导出实现方案

本文梳理 `prepare/b.xlsx` 模板结构，并给出在小程序端实现“批量导出住户档案”功能的完整方案。

## 模板结构分析

- **工作表**：共 3 个，无数据的 `Sheet2`、`Sheet3` 保留；`Sheet1` 数据区域为 `A1:T261`，存在冻结窗格（左侧两列、前两行）。
- **表头布局**：
  - 第 1 行为分组标题，包含 9 个合并单元格（如 `F1:I1`=“患儿基本信息”、“P1:T1”=“家庭基本情况”）。
  - 第 2 行为子标题，行高同为 27rpx，`A1:A2`~`E1:E2` 纵向合并显示单列标题。
- **列设置**：共 20 列。部分列自定义宽度，例如 A=12.38、D=12.5、E=15.76、F=11.5、I=20.26、M=28.76、N=32.26、O=27.26、R=20.76、S=18.76、T=30.63 等；`P/Q` 列默认隐藏但仍需写入数据。
- **样式**：
  - 统一字体 11pt 宋体；表头加粗并水平居中。
  - 数据区主要样式索引为 8（垂直居中+自动换行），日期列使用 `yyyy年m月d日` 专用样式（索引 3/6/14/18/21），身份证等使用文本格式（索引 4/9/15/19/22）。
  - 行高由 Excel 自动记忆，写入时复制模板样式即可复用换行、对齐效果。

## 数据字段映射

| 列 | 字段 | 说明 |
| --- | --- | --- |
| A | `serialNumber` | 导出序号，从 1 递增 |
| B | `patientName` | 患者姓名 |
| C | `genderLabel` | `mapGenderLabel` 结果 |
| D | `admissionDate` | 最近入住日期文字（保持 `2020.6.3` 格式） |
| E | `summaryCaregivers` | 监护人集合，使用 `、` 分隔 |
| F | `birthDate` | 出生日期文本 |
| G | `nativePlace` | 籍贯 |
| H | `ethnicity` | 民族 |
| I | `idNumber` | 身份证号，保留文本格式 |
| J | `hospital` | 优先取 `latestHospital`，无则 `firstHospital` |
| K | `diagnosis` | 优先取 `latestDiagnosis` |
| L | `doctor` | 优先取 `latestDoctor` |
| M | `symptoms` | Excel 导入记录或最近档案的症状描述 |
| N | `treatmentProcess` | 治疗过程 |
| O | `followUpPlan` | 后续治疗安排 |
| P | `address` | 家庭地址（列默认隐藏） |
| Q | `fatherInfo` | 父亲姓名/电话/证件号（默认隐藏） |
| R | `motherInfo` | 母亲信息 |
| S | `otherGuardian` | 其他监护人 |
| T | `familyEconomy` | 家庭经济情况 |

若某字段缺失，写入空字符串，但需保留原样式（含换行）。

## 实现步骤

### 1. 模板复用

- 模板文件已上传至云存储：`cloud://cloud1-6g2fzr5f7cf51e38.636c-cloud1-6g2fzr5f7cf51e38-1375978325/data/b.xlsx`，导出时直接下载并复用。
- 云函数导出时始终读取该模板，避免手工重建样式。
- 推荐使用 `exceljs`（支持保留样式并克隆行），在云函数目录 `cloudfunctions/patientProfile` 中新增依赖：
  ```bash
  npm install exceljs
  ```

### 2. 云函数扩展

- 在 `patientProfile` 中新增 `action: 'export'`：
  - 参数：`patientKeys`（字符串数组，允许为空数组用于批量）。
  - 流程：
    1. 下载模板并加载工作簿；
    2. 删除模板示例数据行（第 3 行起），保留头部行/合并/冻结设置；
    - 查询 `patients` 集合，批量获取基础字段；
    - 为补充 `symptoms/treatmentProcess/followUpPlan` 等 Excel 原始信息，可联合 `excel_records`（按 `recordKey`、`excelRecordKeys` 或 `patientName` 匹配），若 `raw.cells` 可用直接按索引读取；
    - 前端在调用导出时同步传递当前列表项的快照字段，云函数在数据库缺失时可用这些快照回填；
    - 若同一住户存在多条 Excel 记录，循环逐条写入，序号按导出顺序重新编号；
    - 写入数据行时克隆模板第 3 行样式，填充 A~T 列；
    - 设置 `worksheet.getColumn(16).hidden = worksheet.getColumn(17).hidden = true`，保持 P/Q 列隐藏；
    - 保存到临时文件，上传至云存储 `exports/patient-report-${timestamp}.xlsx`，返回 `fileID` 和导出数量。

### 3. 前端对接

- 在列表页长按操作菜单的“导出报告”中调用新 action：
  1. 批量模式时收集 `selectedPatientMap`，否则使用当前卡片患者；
  2. 若无选中对象，提示用户先选择；
  3. `wx.showLoading('导出中…')`，调用 `wx.cloud.callFunction({ name: 'patientProfile', data: { action: 'export', patientKeys } })`；
  4. 成功后使用 `wx.cloud.downloadFile` 得到本地路径，并调用 `wx.openDocument({ filePath, showMenu: true })` 供用户查看/分享；
  5. 失败时展示云函数返回的错误信息；
  6. 操作完成后隐藏 loading。

### 4. 数据校验与留痕

- 云函数记录导出日志（导出人、数量、时间、参数），便于审计。
- 若部分患者未能匹配 `excel_records` 原始数据，可在响应中返回 `missingKeys`，前端提醒“部分档案缺少 Excel 原始信息”。
- 导出逻辑应限制最大行数（例如 1000 条），超过时提示用户拆分导出。

## 测试建议

1. 选择单个住户导出，对比 `prepare/b.xlsx` 头三行格式（列宽、合并、隐藏列、字体、换行、日期格式）。
2. 批量选择多名住户，验证序号递增和换行内容是否与列表数据一致。
3. 人为移除某些字段，确认导出文件仍保留单元格样式而不报错。
4. 权限不足（无法创建患者）或无选中项时，前端需正确提示并不调用云函数。

## 后续扩展

- 支持带筛选条件导出：在云函数中复用 `buildFilteredPatients` 的逻辑，接受筛选参数生成临时列表。
- 可增加头部导出时间、操作人信息（例如在 `Sheet2` 存放元数据），便于追溯。
- 若需国际化，可在模板中增加英文工作表并按需选择。
