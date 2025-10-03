# patient_card_use_cases.md

## 用例 1：compact 模式患者卡片

```xml
<patient-card
  patient="{{{
    id: 'p-001',
    name: '张三',
    ageText: '35岁',
    latestEvent: '2025-10-01 · 随访复查',
    tags: ['肿瘤科', '王主任']
  }}}"
  mode="compact"
  status="success"
  badges="{{[
    { text: '在院', type: 'success' },
    { text: '需复查', type: 'danger' },
    { text: '入住 3 次', type: 'default' }
  ]}}"
  actions="{{[
    { id: 'view', label: '查看详情', type: 'primary', ghost: true },
    { id: 'remind', label: '发起提醒', type: 'default' }
  ]}}"
  bind:cardtap="onPatientTap"
  bind:actiontap="onCardAction"
  bind:selectchange="onSelectChange"
/>
```

## 用例 2：list 模式摘要卡片

```xml
<patient-card
  patient="{{{
    patientName: '李四',
    age: 28,
    latestDiagnosis: '术后随访',
    firstHospital: '北京协和医院'
  }}}"
  mode="list"
  status="info"
  badges="{{[
    { text: '随访', type: 'info' }
  ]}}"
  actions="{{[{ id: 'view', label: '查看详情', type: 'primary', ghost: true }]}}"
  selectable="{{true}}"
  selected="{{false}}"
  bind:cardtap="onPatientTap"
  bind:selectchange="onSelectChange"
/>
```
