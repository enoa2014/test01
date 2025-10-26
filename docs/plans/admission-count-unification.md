# 入住次数口径统一与流程优化方案

## 背景与问题陈述
- **现状**：住户列表页依赖云函数 `patientProfile.list` 聚合出的 `admissionCount`，详情页则调用 `patientIntake.getAllIntakeRecords` 返回的原始记录并在前端自行过滤/去重，导致同一住户在不同页面展示的入住次数不一致（如“林日燊”列表 1 次、详情 3 次）。
- **根因**：
  1. 列表与详情使用的云函数不同，过滤、去重与状态判断逻辑不一致。
  2. 前端与后端缺乏统一的数据契约，导致状态枚举、字段含义散落各处。
  3. 原始记录与聚合结果各自维护，没有版本/缓存策略，容易出现旧数据残留。
- **目标**：统一所有入口的入住次数口径，确保同一数据来源；强化数据一致性、可维护性与后续扩展能力。

## 优化原则
1. **单一事实来源**：云端统一计算展示所需的入住记录与次数，前端仅消费该结果。
2. **显式数据契约**：状态、字段、接口定义集中维护，避免魔法字符串和隐式约定。
3. **可观测可回滚**：重要流程需埋点日志与版本标识，便于回溯与排查。

## 总体路线图
| 阶段 | 目标 | 核心产出 |
| --- | --- | --- |
| Phase 0 | 现状梳理与数据修正 | 清理历史计数误差、对齐测试覆盖 |
| Phase 1 | 数据口径统一 | 云函数 `patientIntake.getAllIntakeRecords` 引入统一过滤/去重逻辑，前端改用同一结果 |
| Phase 2 | 数据契约与缓存策略 | 共享 schema、版本号与缓存策略，减少重复计算，提高一致性 |
| Phase 3 | 监控告警与自动化 | 埋点、监控面板、自动修复脚本，保障后续演进 |

## Phase 0：现状梳理与历史数据修正
- **任务**
  - [ ] 审查 `patient_intake_records` 中草稿与 Excel 聚合中间态，统计异常数量（SQL/云开发查询）。
  - [ ] 运行或编写脚本（`scripts/data/repair-admission-count.js`）重新计算每位住户的有效入住次数，与聚合表对齐。
  - [ ] 补充单元测试覆盖：保证 `buildPatientGroups`、`dedupeIntakeRecords` 对草稿/重复的过滤。
- **交付**
  - [ ] 数据修复报告（异常记录总数、修复数量、剩余疑难项）。
  - [ ] 新增测试用例及结果截图。

## Phase 1：数据口径统一
### 1. 云函数改造
- **职责模块**：`cloudfunctions/patientIntake/index.js` `handleGetAllIntakeRecords`
- **改造要点**
  - [x] 调用 `cloudfunctions/utils/patient.js` 内的 `shouldCountIntakeRecord`、`dedupeIntakeRecords`、`extractRecordTimestampForKey` 等工具，直接在云端过滤草稿、Excel 中间态。
  - [x] 返回结构扩展为：`{ records: [...], count, summaryVersion }`，`count` 即 dedupe 后数量。
  - [x] 对 `summaryVersion` 使用 `syncExcelRecordsToIntake` 的返回或新增自增版本号，以便缓存与一致性校验。

### 2. 前端调整
- **涉及文件**：`wx-project/pages/patient-detail/detail.js`
- **变更**
  - [x] 放弃前端 `dedupeIntakeRecords`，直接使用云端返回的 `records` 与 `count`。
  - [x] `patient.admissionCount`、`allIntakeRecords.length` 均引用云端 `count`。
  - [x] 若保留 Excel 原始记录展示需求，新增“原始数据”Tab，调用专门接口。默认 UI 只展示统一口径。

### 3. 验证
- 编写 E2E 或手动测试场景：
  - [ ] Excel 导入重复记录 + 手动录入；
  - [ ] Draft 状态提交前后；
  - [ ] 老数据 + 新数据混合。
- [ ] 通过 `tests/unit`、`tests/e2e` 与线上灰度数据验证后，再发布。

## Phase 2：数据契约与缓存策略
### 1. 统一数据契约
- 在 `cloudfunctions/common/patient-data/schema.js` 定义：
  - [ ] 入住记录字段、状态、枚举；
  - [ ] 聚合结果结构（含 `count`、`latestAdmissionTimestamp` 等）；
  - [ ] 通过 npm workspace 或自动同步脚本让 `patientProfile`、`patientIntake`、小程序端共享。
- [ ] 为前端提供 TypeScript 类型定义 (`wx-project/types/patient.d.ts`)，减少魔法字段。

### 2. 缓存与版本
- [ ] 引入云端 KV 缓存：`patients_summary_cache` 添加 `summaryVersion`。
- [ ] `patientIntake.getAllIntakeRecords` 支持：若请求带上 `knownVersion`，且未变更则返回 `not_modified`，减少 DB 负载。
- 缓存更新策略：
  - [ ] `syncExcelRecordsToIntake` 成功后更新版本；
  - [ ] 手工录入/编辑后触发缓存失效。

## Phase 3：监控与自动化
### 1. 监控指标
- 在云函数中记录：
  - [ ] `draftFilteredCount`、`excelDuplicateMergedCount` 等指标（写入日志或自定义监控）。
  - [ ] 若发现 `count === 0` 且存在原始记录，写告警日志。
- [ ] 小程序端埋点：用户切换详情页时上报 `recordsCount` 与 `summaryVersion`，方便排查。

### 2. 自动修复脚本
- 脚本功能：
  - [ ] 扫描住户，比较 `patientProfile` 和 `patientIntake` 的 `count`，发现差异即重新触发 `syncExcelRecordsToIntake` 或写入人工排查列表。
  - [ ] 可在部署后、定期（如每天凌晨）运行。

## 风险与回滚预案
- **风险点**
  - 改造后若云端去重规则有误，会影响所有页面显示的入住记录。
  - 版本号/缓存策略实现不当可能导致数据长期不刷新。
- **回滚方式**
  - 保留原 `dedupeIntakeRecords` 前端逻辑做灰度开关；
  - `patientIntake` 接口保留开关参数 `useLegacyAggregation`，便于紧急回退。

## 项目管理建议
- **里程碑**
  1. Phase 0 完成时间：T + 2 天。
  2. Phase 1 完成时间：Phase 0 后 3~4 天内完成功能开发、自测、灰度。
  3. Phase 2~3 可串行推进，预计 1~2 周。
- **协作角色**
  - 后端云函数负责人：统一聚合逻辑、缓存策略实现。
  - 小程序前端：改造详情页、数据契约引用。
  - 测试/QA：设计回归场景、监控指标验证。

## 交付清单
- 更新后的云函数代码与小程序代码。
- 数据修复与验证报告。
- 新增的自动化测试与监控仪表板。
- 优化方案复盘文档。

---
如需按阶段拆分任务，可将本方案导入到项目管理工具（如 Jira、Notion）并补充负责人与预计时间。EOF
