# patientService 聚合服务

- 作用：作为聚合/代理服务，将部分请求委派到 `patientProfile` 并扩展 `fullDetail` 能力。
- 代码位置：`cloudfunctions/patientService/index.js`

## 动作（actions）

- `detail` / `fullDetail`
  - 入参：与 `patientProfile.detail` 相同（根据实现扩展）
  - 出参：患者详情对象；`fullDetail` 可包含更多聚合字段
  - 说明：内部调用 `handleGetPatientFullDetail`
- `list` / `delete`
  - 说明：委派到 `patientProfile.main(event)`

## 错误格式

- `{ success: true, ... }` 或 `{ success: false, error: { code, message, details? } }`

## 示例

```js
// Full detail via aggregator
wx.cloud.callFunction({ name: 'patientService', data: { action: 'fullDetail', key: 'patient_key' } })
```

## 参考
- 上层概览：../../cloud-function-architecture.md
- 相关：../patient-profile/README.md

