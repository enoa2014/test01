# 数据库 Schema（草案）

> 范围：云开发数据库集合、字段定义、关系与索引。用于指导数据脚本、云函数与前端数据消费。

## 集合一览
- `excel_records`：Excel 原始数据
- `excel_cache`：患者列表/聚合缓存（TTL）
- `patients`：患者档案（去重后的主体）
- `patient_intake_records`：入院（就诊）记录

## 字段定义（草案）

### patients
- `_id`：字符串，主键
- `patientKey`：字符串，业务唯一键（建议：姓名+生日+性别哈希）
- `patientName`：字符串，姓名
- `gender`：枚举（男/女/未知）
- `birthDate`：字符串（YYYY-MM-DD）
- `admissionCount`：数字，累计入院次数
- `firstDiagnosis`：字符串
- `latestDiagnosis`：字符串
- `latestAdmissionDate`：字符串（YYYY-MM-DD）
- `latestAdmissionTimestamp`：数字（ms）
- `latestHospital`：字符串
- `latestDoctor`：字符串
- `createdAt`/`updatedAt`：数字（ms）

索引建议：
- `patientKey` 唯一索引
- `latestAdmissionTimestamp` 倒序索引（列表排序）

### patient_intake_records
- `_id`：字符串
- `patientKey`：字符串（关联 patients.patientKey）
- `admissionDate`：字符串（YYYY-MM-DD）
- `admissionTimestamp`：数字（ms）
- `hospital`：字符串
- `doctor`：字符串
- `diagnosis`：字符串
- `notes`：字符串（可选）
- `createdAt`/`updatedAt`：数字（ms）

索引建议：
- `patientKey + admissionTimestamp` 复合索引（按患者时间线）

### excel_records
- 源字段视 Excel 表头为准，至少包含：姓名、性别、出生日期、就诊/入院日期、医院、诊断
- `sourceRowIndex`：数字（行号）
- `importBatchId`：字符串（导入批次）
- `createdAt`：数字（ms）

### excel_cache
- `cacheKey`：字符串（如 patients_summary_cache）
- `payload`：对象（聚合数据）
- `ttl`：数字（过期时间戳）

## 关系与数据流
- `excel_records` → 同步 → `patients` + `patient_intake_records`
- `patients`/`patient_intake_records` → 聚合 → `excel_cache`

## 约束与校验
- 姓名/生日/性别用于去重与 key 生成
- 日期字段统一为 `YYYY-MM-DD`，并提供工具转换为 timestamp
- 空值策略：前端展示时兜底（如“暂无诊断”）

## 示例记录（patients）
```json
{
  "_id": "abc123",
  "patientKey": "ZhangSan-2010-01-01-M",
  "patientName": "张三",
  "gender": "男",
  "birthDate": "2010-01-01",
  "admissionCount": 3,
  "firstDiagnosis": "急性支气管炎",
  "latestDiagnosis": "急性支气管炎",
  "latestAdmissionDate": "2025-09-20",
  "latestAdmissionTimestamp": 1758326400000,
  "latestHospital": "北京儿童医院",
  "latestDoctor": "李医生",
  "createdAt": 1758000000000,
  "updatedAt": 1758326400000
}
```

## 后续计划
- 落实约束到云函数写入逻辑与工具校验
- 增补历史迁移与字段演进记录

