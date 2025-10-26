# 测试数据清理机制

## 概述

本项目实现了完善的测试数据自动清理机制,确保 E2E 测试不会在数据库中留下残留数据。

## 测试数据标记规范

### 标记前缀

所有测试数据必须使用 `TEST_AUTOMATION_` 前缀,例如:

- `TEST_AUTOMATION_20250930123456_abc123` (患者名称)
- `TEST_AUTOMATION_20250930_ALPHA` (测试患者 key)

### 标记字段

测试数据使用以下字段进行标记:

```javascript
{
  key: 'TEST_AUTOMATION_...',
  patientKey: 'TEST_AUTOMATION_...',
  patientName: 'TEST_AUTOMATION_...',
  testMarker: 'TEST_AUTOMATION_20250930123456',
  _source: 'automation',
  _runId: 'TEST_AUTOMATION_20250930123456'
}
```

## 清理覆盖范围

### 数据库集合

自动清理脚本覆盖以下集合:

- `excel_records` - Excel 导入的患者记录
- `patient_intake_records` - 入住向导创建的记录
- `excel_cache` - 患者数据缓存
- `patients` - 同步的患者数据

### 匹配规则

清理脚本使用多重匹配规则识别测试数据:

1. `testMarker` 字段存在
2. `key` 字段以 `TEST_AUTOMATION_` 开头
3. `patientKey` 字段以 `TEST_AUTOMATION_` 开头
4. `patientName` 字段以 `TEST_AUTOMATION_` 开头

支持根级字段和 `data.*` 嵌套字段。

## 使用方法

### 1. 运行完整测试套件(自动清理)

```bash
npm run test:e2e:patients
```

这个命令会:

1. **测试前清理**: 删除所有历史测试数据
2. **插入测试数据**: 创建带标记的测试记录
3. **执行 E2E 测试**: 运行完整测试套件
4. **测试后清理**: 删除本次测试创建的所有数据

即使测试失败,`finally` 块也会确保清理执行。

### 2. 验证残留测试数据

```bash
npm run test:cleanup-verify
```

扫描数据库中所有集合,列出残留的测试数据:

```
⚠️  Found 3 test records:

📦 patient_intake_records: 2 records
   1. {
     "_id": "...",
     "patientName": "TEST_AUTOMATION_...",
     "testMarker": "TEST_AUTOMATION_20250930123456"
   }
   ...

📦 excel_records: 1 records
   ...
```

### 3. 手动清理测试数据

```bash
npm run test:cleanup
```

强制清理数据库中所有测试数据,适用于:

- 测试异常中断后清理
- 开发调试后清理
- 定期数据库维护

## 清理机制实现

### 核心清理函数

```javascript
async function removeExistingTestData(collection, command, db) {
  const matcher = command.or([
    { testMarker: command.exists(true) },
    { ['data.testMarker']: command.exists(true) },
    { key: db.RegExp({ regexp: '^TEST_AUTOMATION_' }) },
    { ['data.key']: db.RegExp({ regexp: '^TEST_AUTOMATION_' }) },
    { patientKey: db.RegExp({ regexp: '^TEST_AUTOMATION_' }) },
    { ['data.patientKey']: db.RegExp({ regexp: '^TEST_AUTOMATION_' }) },
    { patientName: db.RegExp({ regexp: '^TEST_AUTOMATION_' }) },
    { ['data.patientName']: db.RegExp({ regexp: '^TEST_AUTOMATION_' }) },
  ]);

  // 尝试批量删除
  try {
    const bulk = await collection.where(matcher).remove();
    if (bulk && typeof bulk.deleted === 'number') {
      return bulk.deleted;
    }
  } catch (error) {
    // 批量删除失败,使用逐条删除
  }

  // 逐条删除作为备用方案
  const batchSize = 100;
  while (true) {
    const snapshot = await collection.where(matcher).limit(batchSize).get();
    if (!snapshot.data.length) break;

    for (const doc of snapshot.data) {
      await collection.doc(doc._id).remove();
    }

    if (snapshot.data.length < batchSize) break;
  }
}
```

### 多集合清理

```javascript
const COLLECTIONS = ['excel_records', 'patient_intake_records', 'excel_cache', 'patients'];

for (const collectionName of COLLECTIONS) {
  const collection = db.collection(collectionName);
  await removeExistingTestData(collection, command, db);
}
```

## 测试辅助函数

### createPatientViaWizard

创建测试患者时自动使用正确前缀:

```javascript
const patientData = {
  patientName: randomString('TEST_AUTOMATION'), // ✅ 正确
  // patientName: randomString('PATIENT'),      // ❌ 错误,无法被清理
  idNumber: generateIdNumber(),
  // ...
};
```

## 故障排查

### 问题: 测试后仍有残留数据

**检查步骤**:

1. 验证测试数据前缀是否正确:

   ```bash
   npm run test:cleanup-verify
   ```

2. 查看具体残留数据的字段:
   - 确认是否包含 `testMarker`
   - 确认 `key/patientKey/patientName` 是否以 `TEST_AUTOMATION_` 开头

3. 手动清理:
   ```bash
   npm run test:cleanup
   ```

### 问题: 清理脚本执行失败

**可能原因**:

- 云开发凭证配置错误
- 网络连接问题
- 数据库权限不足

**解决方案**:
检查 `.env` 文件配置:

```bash
TCB_ENV=cloud1-6g2fzr5f7cf51e38
TENCENTCLOUD_SECRETID=...
TENCENTCLOUD_SECRETKEY=...
```

## 最佳实践

### 1. 始终使用标准前缀

```javascript
// ✅ 推荐
const testName = randomString('TEST_AUTOMATION');

// ❌ 不推荐
const testName = randomString('PATIENT');
const testName = 'MyTestPatient_' + Date.now();
```

### 2. 添加测试标记

```javascript
const record = {
  patientName: testName,
  testMarker: RUN_ID, // ✅ 添加 testMarker
  _source: 'automation', // ✅ 标记数据来源
  _runId: RUN_ID, // ✅ 记录测试运行 ID
};
```

### 3. 定期验证清理效果

开发期间定期运行:

```bash
npm run test:cleanup-verify
```

### 4. CI/CD 集成

在 CI 流程中添加清理验证步骤:

```yaml
- name: Run E2E Tests
  run: npm run test:e2e:patients

- name: Verify Cleanup
  run: npm run test:cleanup-verify
  if: always() # 即使测试失败也验证
```

## 相关文件

- `scripts/e2e/run-patient-suite.js` - 测试套件执行和清理
- `scripts/e2e/verify-cleanup.js` - 清理验证脚本
- `tests/e2e/helpers/patient-flow.js` - 测试数据创建辅助函数
- `package.json` - 测试和清理命令定义

## 更新历史

- **2025-09-30**:
  - 修复 `patient-flow.js` 前缀不一致问题
  - 扩展清理脚本覆盖 4 个数据库集合
  - 新增 8 种字段匹配规则
  - 添加 `test:cleanup-verify` 和 `test:cleanup` 命令
