# 数据模型设计文档

## 概述

本文档描述了患者入住管理系统的数据模型设计，包括各个集合的字段定义、关系映射和同步策略。

## 集合设计

### 1. excel_records（Excel导入数据）

Excel文件导入的原始数据，作为数据源。

**新增同步字段**：

```javascript
{
  // 现有字段...
  processed: Boolean,             // 是否已同步到患者集合
  syncedAt: Date,                 // 同步时间
  syncBatchId: String             // 同步批次ID
}
```

### 2. patients（患者主档案）

患者基础信息的主表，由Excel数据同步生成并可由入住向导更新。

**字段定义**：

```javascript
{
  _id: String,                    // 患者Key（格式：P{timestamp}_{uuid}）
  // 基础信息
  patientName: String,            // 患者姓名 *必填
  idType: String,                 // 证件类型（身份证/护照/军官证/其他）
  idNumber: String,               // 证件号码 *必填
  gender: String,                 // 性别（男/女）*必填
  birthDate: String,              // 出生日期（YYYY-MM-DD）*必填
  phone: String,                  // 联系电话

  // 联系信息
  address: String,                // 常住地址 *必填
  emergencyContact: String,       // 紧急联系人 *必填
  emergencyPhone: String,         // 紧急联系人电话 *必填
  backupContact: String,          // 备用联系人
  backupPhone: String,            // 备用联系人电话

  // 统计信息
  admissionCount: Number,         // 总入住次数
  firstAdmissionDate: Date,       // 首次入住时间
  latestAdmissionDate: Date,      // 最近入住时间
  lastIntakeNarrative: String,    // 最近入住说明

  // 同步信息
  sourceType: String,             // 数据来源（excel/manual）
  sourceRecordId: String,         // 源记录ID（如Excel记录ID）
  syncedAt: Date,                 // 同步时间

  // 元数据
  createdAt: Date,                // 创建时间
  updatedAt: Date                 // 更新时间
}
```

### 3. patient_intake_records（入住记录）

每次患者入住的详细记录。

**字段定义**：

```javascript
{
  _id: String,                    // 记录ID
  patientKey: String,             // 患者Key（关联patients._id）*必填
  patientName: String,            // 患者姓名（冗余字段，便于查询）
  intakeId: String,               // 入住ID（格式：I{timestamp}_{uuid}）

  // 基础信息快照
  basicInfo: {
    patientName: String,          // 患者姓名
    idType: String,               // 证件类型
    idNumber: String,             // 证件号码
    gender: String,               // 性别
    birthDate: String,            // 出生日期
    phone: String                 // 联系电话
  },

  // 联系信息快照
  contactInfo: {
    address: String,              // 常住地址
    emergencyContact: String,     // 紧急联系人
    emergencyPhone: String,       // 紧急联系人电话
    backupContact: String,        // 备用联系人
    backupPhone: String           // 备用联系人电话
  },

  // 入住信息
  intakeInfo: {
    intakeTime: Date,             // 入住时间 *必填
    situation: String,            // 情况说明 *必填
    medicalHistory: Array,        // 医疗就诊情况
    attachments: Array            // 附件列表
  },

  // 元数据
  metadata: {
    isEditingExisting: Boolean,   // 是否编辑已有患者
    submittedAt: Date,            // 提交时间
    submittedBy: String           // 提交者
  }
}
```

## 同步策略

### Excel → Patients 同步规则

**触发条件**：

- Excel导入完成后自动调用
- 手动调用 patientIntake.syncFromExcel 接口

**字段映射规则**：

```javascript
// excel_records → patients
{
  patientName: record.patientName,
  idType: "身份证",                    // 默认身份证
  idNumber: record.idNumber,
  gender: record.gender,
  birthDate: record.birthDate,
  phone: extractPhone(record.fatherInfo || record.motherInfo),
  address: record.address,
  emergencyContact: extractContact(record.fatherInfo || record.motherInfo),
  emergencyPhone: extractPhone(record.fatherInfo || record.motherInfo),
  admissionCount: 统计该患者的记录数,
  firstAdmissionDate: 最早的admissionDate,
  latestAdmissionDate: 最晚的admissionDate,
  sourceType: "excel",
  sourceRecordId: record._id,
  syncedAt: new Date()
}
```

**幂等性保证**：

- 使用姓名+证件号作为唯一性判断
- 重复同步时更新统计信息，不创建新记录
- 记录syncBatchId避免重复处理

## 数据关系

```
excel_records → patients (1:1 或 N:1，按姓名+证件号合并)
patients → patient_intake_records (1:N)
patient_intake_records → patient_media (1:N，通过intakeId关联)
```
