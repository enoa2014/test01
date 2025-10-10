# 入住流程表单字段与校验（patientIntake）

> 来源：cloudfunctions/patientIntake/index.js（基于源码提炼）。用于 createPatient / updatePatient / submit 等动作。

## 必填字段
- `patientName`（患者姓名）：非空
- `idNumber`（证件号码）：非空；当 `idType === '身份证'` 时，需通过中国身份证 15/18 位校验（18 位含校验位）
- `gender`（性别）：非空
- `birthDate`（出生日期）：非空；必须是有效日期，且不晚于今天，不早于 1900-01-01
- `address`（常住地址）：非空

## 可选字段与格式
- `idType`（证件类型）：默认 `'身份证'`
- `phone`、`backupPhone`（手机号）：可选；如提供，需匹配 `^1[3-9]\d{9}$`
- `visitHospital`（就诊医院）、`hospitalDiagnosis`（医院诊断）、`attendingDoctor`（主治医生）
- `situation`（情况说明）、`symptomDetail`（症状详情）、`treatmentProcess`（医治过程）、`followUpPlan`（后续治疗安排）
  - 文本长度上限：500（SITUATION_MAX_LENGTH）
- 监护/家长信息：`fatherInfo`、`fatherContactName`、`fatherContactPhone`、`motherInfo`、`motherContactName`、`motherContactPhone`、`guardianInfo`、`guardianContactName`、`guardianContactPhone`

## 字段约束表（节选）

| 字段 | 标签 | 必填 | 类型/范围 | 规则 |
| --- | --- | --- | --- | --- |
| `patientName` | 患者姓名 | 是 | string | 非空 |
| `idType` | 证件类型 | 否 | enum | 默认 身份证 |
| `idNumber` | 证件号码 | 是 | string | 若身份证需通过 15/18 位规则与校验码 |
| `gender` | 性别 | 是 | enum | 非空（具体值由前端输入约束） |
| `birthDate` | 出生日期 | 是 | YYYY-MM-DD | 合法日期，≤ 今天，≥ 1900-01-01 |
| `phone` | 手机 | 否 | string | 正则 `^1[3-9]\d{9}$`（如提供） |
| `backupPhone` | 备用手机 | 否 | string | 同上（如提供） |
| `address` | 常住地址 | 是 | string | 非空 |
| `situation` | 情况说明 | 否 | string | ≤ 500 字 |
| `hospitalDiagnosis` | 医院诊断 | 否 | string | ≤ 500 字 |
| `symptomDetail` | 症状详情 | 否 | string | ≤ 500 字 |
| `treatmentProcess` | 医治过程 | 否 | string | ≤ 500 字 |
| `followUpPlan` | 后续治疗安排 | 否 | string | ≤ 500 字 |

## 提交与更新示例

创建（createPatient）：
```js
wx.cloud.callFunction({
  name: 'patientIntake',
  data: {
    action: 'createPatient',
    formData: {
      patientName: '张三',
      idType: '身份证',
      idNumber: '110101199001011234',
      gender: '男',
      birthDate: '2015-06-01',
      phone: '13900001234',
      address: '北京市东城区',
      visitHospital: '北京儿童医院',
      hospitalDiagnosis: '急性支气管炎',
      attendingDoctor: '李医生',
      situation: '近 1 周内持续咳嗽',
    },
  },
});
```

更新（updatePatient）：
```js
wx.cloud.callFunction({
  name: 'patientIntake',
  data: {
    action: 'updatePatient',
    patientKey: 'P123...',
    formData: { phone: '13800001234', address: '海淀区知春路 1 号' },
    audit: { operatorId: 'openId', operatorName: '管理员', message: '更新联系方式' },
  },
});
```

## 相关
- 入参/出参与其他动作：`../../api-reference.md#patientintake`
- 入住条目更新、离开、状态：参见 `updateIntakeRecord`、`checkoutPatient`、`updateCareStatus`

---

## 入住条目与状态操作

### updateIntakeRecord（新增/更新入住条目）
- 入参（部分）：
  - `patientKey`（必填）
  - `intakeId?`（可选；不传则创建、传入则更新该条目）
  - `intakeTime?`（ms 时间戳）
  - `checkoutAt?`（ms 时间戳；设置则表示离开时间）
  - `hospital?`、`diagnosis?`、`doctor?`、`symptoms?`
  - `treatmentProcess?`、`followUpPlan?`
- 返回：`{ success: true, data: { intakeId, intakeTime, checkoutAt?, admissionCount?, latestAdmissionDate? } }`
- 备注：创建/更新后会同步聚合（admissionCount/earliest/latest）

示例：
```js
// 新增一条入住记录
wx.cloud.callFunction({
  name: 'patientIntake',
  data: { action: 'updateIntakeRecord', patientKey, intakeTime: Date.now(), hospital: '北京儿童医院', diagnosis: '呼吸道感染' }
});
```

### checkoutPatient（办理离开）
- 入参：`{ patientKey, checkout: { reason?, note?, operatorId?, operatorName?, timestamp? } }`
- 返回：`{ success: true, data: { patientKey, checkoutAt, reason, note } }`
- 备注：写操作日志、更新聚合、可能影响 careStatus

示例：
```js
wx.cloud.callFunction({ name: 'patientIntake', data: { action: 'checkoutPatient', patientKey, checkout: { reason: '完成治疗', note: '转出', timestamp: Date.now() } } });
```

### updateCareStatus（手动调整住户状态）
- 入参：`{ patientKey, careStatus: 'in_care'|'pending'|'discharged', note?, operatorId?, operatorName? }`
- 返回：`{ success: true, data: { patientKey, careStatus, note, statusAdjustedAt, checkoutAt? } }`
- 备注：当 `careStatus === 'discharged'` 时会写入 checkoutAt；写操作日志与同步缓存

示例：
```js
wx.cloud.callFunction({ name: 'patientIntake', data: { action: 'updateCareStatus', patientKey, careStatus: 'discharged', note: '家属申请' } });
```

---

## 草稿与配置

### saveDraft / getDraft（草稿保存与获取）

- saveDraft 入参：`{ draftId?: string, formData: {...} }`
- saveDraft 返回：`{ success: true, data: { draftId: string, expiresAt: number } }`
- getDraft 入参：`{ draftId: string }`
- getDraft 返回：`{ success: true, data: { formData: {...}, expiresAt: number } }`

字段表（节选）：

| 字段 | 方向 | 必填 | 说明 |
| --- | --- | --- | --- |
| `draftId` | in/out | 否 | 草稿标识；不传则创建新的草稿 ID |
| `formData` | in/out | 是 | 表单对象，结构同 createPatient/updatePatient |
| `expiresAt` | out | 是 | 过期时间戳（ms）；过期草稿会被清理 |

示例：
```js
const save = await wx.cloud.callFunction({ name: 'patientIntake', data: { action: 'saveDraft', formData } });
const d = await wx.cloud.callFunction({ name: 'patientIntake', data: { action: 'getDraft', draftId: save.result.data.draftId } });
```

### getConfig（入住配置）

- 入参：`{}`
- 返回：
  ```json
  {
    "success": true,
    "data": {
      "situationConfig": { "minLength": 0, "maxLength": 500, "keywords": ["..."], "example": "..." },
      "uploadConfig": { "maxFileSize": 10, "maxCount": 5, "allowedTypes": "JPG、PNG、PDF、Word、Excel等" }
    }
  }
  ```

字段表（节选）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `situationConfig.minLength` | number | 情况说明最小长度（默认 0） |
| `situationConfig.maxLength` | number | 情况说明最大长度（默认 500） |
| `situationConfig.keywords` | string[] | 关键词建议（可用于提示） |
| `situationConfig.example` | string | 示例文案 |
| `uploadConfig.maxFileSize` | number | 单文件大小上限（MB） |
| `uploadConfig.maxCount` | number | 单次/总量上限（见实现） |
| `uploadConfig.allowedTypes` | string | 允许类型描述 |
