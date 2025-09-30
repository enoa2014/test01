# 云数据库清空与重新初始化指南

本文档记录了WeChat小程序云数据库的完整清空和重新初始化流程，包括数据备份、清理、重新导入和验证的详细步骤。

## 📋 目录

- [概述](#概述)
- [前置条件](#前置条件)
- [操作流程](#操作流程)
- [故障排除](#故障排除)
- [验证清单](#验证清单)

## 📖 概述

### 涉及的数据库集合

本项目使用以下云数据库集合：

| 集合名称 | 用途 | 记录类型 |
|---------|------|----------|
| `excel_records` | Excel原始数据存储 | 患者入院记录原始数据 |
| `excel_cache` | 患者汇总缓存 | 30分钟TTL的患者列表缓存 |
| `patients` | 患者档案 | 去重后的患者基本信息 |
| `patient_intake_records` | 入住记录 | 患者入住流程记录 |

### 数据流架构

```
Excel文件 → readExcel(import) → excel_records
                ↓
         readExcel(syncPatients) → patients + patient_intake_records
                ↓
         patientProfile(list) → excel_cache
```

## 🔧 前置条件

### 环境变量配置

确保以下环境变量已正确设置：

```bash
# 云开发环境配置
TCB_ENV=cloud1-6g2fzr5f7cf51e38
TENCENTCLOUD_SECRETID=your_secret_id
TENCENTCLOUD_SECRETKEY=your_secret_key

# Excel数据源文件
EXCEL_FILE_ID=cloud://cloud1-6g2fzr5f7cf51e38.636c-cloud1-6g2fzr5f7cf51e38-1375978325/data/b.xlsx
```

### 依赖检查

```bash
# 检查项目依赖
npm list @cloudbase/node-sdk
npm list xlsx

# 检查微信开发者工具CLI
"C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" --help
```

### 云函数状态确认

```bash
# 确保云函数已部署
"C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" cloud functions list --env cloud1-6g2fzr5f7cf51e38 --project "C:\Users\86152\work\test01"
```

## 🚀 操作流程

### 第一阶段：数据备份（可选）

如果需要保留当前数据，建议先进行备份：

```javascript
// backup-database.js
const tcb = require("@cloudbase/node-sdk");

// 初始化配置
const app = tcb.init({
  env: process.env.TCB_ENV,
  secretId: process.env.TENCENTCLOUD_SECRETID,
  secretKey: process.env.TENCENTCLOUD_SECRETKEY
});

async function backupCollection(collectionName) {
  const db = app.database();
  const allData = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const res = await db.collection(collectionName)
      .skip(skip)
      .limit(limit)
      .get();

    if (!res.data || res.data.length === 0) break;

    allData.push(...res.data);
    skip += res.data.length;
  }

  // 保存到本地文件
  require('fs').writeFileSync(
    `backup_${collectionName}_${Date.now()}.json`,
    JSON.stringify(allData, null, 2)
  );

  return allData.length;
}
```

### 第二阶段：数据库清空

#### 2.1 创建清空脚本

```javascript
// clear-database.js
const tcb = require("@cloudbase/node-sdk");

const app = tcb.init({
  env: process.env.TCB_ENV,
  secretId: process.env.TENCENTCLOUD_SECRETID,
  secretKey: process.env.TENCENTCLOUD_SECRETKEY
});

const db = app.database();
const collections = [
  'excel_records',
  'excel_cache',
  'patients',
  'patient_intake_records'
];

async function clearCollection(collectionName) {
  console.log(`开始清空集合: ${collectionName}`);

  try {
    const collection = db.collection(collectionName);
    const BATCH_SIZE = 20;
    let totalDeleted = 0;

    while (true) {
      const res = await collection.limit(BATCH_SIZE).get();
      const docs = res && Array.isArray(res.data) ? res.data : [];

      if (!docs.length) break;

      const deletePromises = docs
        .filter(doc => doc && doc._id)
        .map(doc =>
          collection.doc(doc._id).remove()
            .catch(error => {
              console.warn(`删除文档失败 ${collectionName}/${doc._id}:`, error.message);
              return null;
            })
        );

      await Promise.all(deletePromises);
      totalDeleted += docs.length;
      console.log(`  已删除 ${docs.length} 条记录，累计 ${totalDeleted} 条`);
    }

    console.log(`✅ 集合 ${collectionName} 清空完成，共删除 ${totalDeleted} 条记录`);
    return totalDeleted;

  } catch (error) {
    if (error.errCode === -502005 ||
        (error.errMsg && error.errMsg.includes('DATABASE_COLLECTION_NOT_EXIST'))) {
      console.log(`ℹ️  集合 ${collectionName} 不存在，跳过清空`);
      return 0;
    }
    throw error;
  }
}

async function clearAllCollections() {
  let totalDeleted = 0;

  for (const collectionName of collections) {
    const deleted = await clearCollection(collectionName);
    totalDeleted += deleted;
  }

  console.log(`\n✅ 所有集合清空完成，共删除 ${totalDeleted} 条记录`);
  return totalDeleted;
}
```

#### 2.2 执行清空操作

```bash
# 设置环境变量并执行清空
TCB_ENV=cloud1-6g2fzr5f7cf51e38 \
TENCENTCLOUD_SECRETID=your_secret_id \
TENCENTCLOUD_SECRETKEY=your_secret_key \
node clear-database.js
```

**预期输出示例：**
```
开始清空集合: excel_records
  已删除 20 条记录，累计 20 条
  已删除 20 条记录，累计 40 条
  ...
✅ 集合 excel_records 清空完成，共删除 247 条记录

开始清空集合: excel_cache
✅ 集合 excel_cache 清空完成，共删除 2 条记录

开始清空集合: patients
✅ 集合 patients 清空完成，共删除 57 条记录

开始清空集合: patient_intake_records
✅ 集合 patient_intake_records 清空完成，共删除 57 条记录

✅ 所有集合清空完成，共删除 363 条记录
```

### 第三阶段：重新导入数据

#### 3.1 确保云函数部署

```bash
# 部署readExcel云函数
"C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" cloud functions deploy \
  --env cloud1-6g2fzr5f7cf51e38 \
  --names readExcel \
  --project "C:\Users\86152\work\test01"
```

#### 3.2 执行数据导入

```javascript
// import-data.js
const tcb = require("@cloudbase/node-sdk");

const app = tcb.init({
  env: process.env.TCB_ENV,
  secretId: process.env.TENCENTCLOUD_SECRETID,
  secretKey: process.env.TENCENTCLOUD_SECRETKEY
});

async function importData() {
  console.log('🚀 开始导入Excel数据...');

  const excelFileId = process.env.EXCEL_FILE_ID ||
    'cloud://cloud1-6g2fzr5f7cf51e38.636c-cloud1-6g2fzr5f7cf51e38-1375978325/data/b.xlsx';

  try {
    const result = await app.callFunction({
      name: 'readExcel',
      data: {
        action: 'import',
        fileId: excelFileId
      }
    });

    if (result.result && result.result.success !== false) {
      console.log('✅ 数据导入成功');
      console.log('📊 导入统计:');
      console.log(`  - 表名: ${result.result.sheetName}`);
      console.log(`  - 导入记录数: ${result.result.imported?.inserted || 0}`);
      console.log(`  - 患者数量: ${result.result.totalPatients || 0}`);

      if (result.result.sync) {
        console.log(`  - 同步患者: ${result.result.sync.patients || 0}`);
        console.log(`  - 同步入住记录: ${result.result.sync.intakeRecords || 0}`);
        console.log(`  - 同步批次ID: ${result.result.sync.syncBatchId || ''}`);
      }

      return result.result;
    } else {
      throw new Error('数据导入失败: ' + JSON.stringify(result.result?.error));
    }

  } catch (error) {
    console.error('❌ 导入失败:', error.message);
    throw error;
  }
}
```

#### 3.3 执行导入

```bash
# 设置环境变量并导入数据
TCB_ENV=cloud1-6g2fzr5f7cf51e38 \
TENCENTCLOUD_SECRETID=your_secret_id \
TENCENTCLOUD_SECRETKEY=your_secret_key \
EXCEL_FILE_ID=cloud://cloud1-6g2fzr5f7cf51e38.636c-cloud1-6g2fzr5f7cf51e38-1375978325/data/b.xlsx \
node import-data.js
```

**预期输出示例：**
```
🚀 开始导入Excel数据...
✅ 数据导入成功
📊 导入统计:
  - 表名: Sheet1
  - 导入记录数: 243
  - 患者数量: 69
  - 同步患者: 69
  - 同步入住记录: 69
  - 同步批次ID: excel-1759191955254
```

### 第四阶段：数据验证

#### 4.1 创建验证脚本

```javascript
// verify-data.js
const tcb = require("@cloudbase/node-sdk");

const app = tcb.init({
  env: process.env.TCB_ENV,
  secretId: process.env.TENCENTCLOUD_SECRETID,
  secretKey: process.env.TENCENTCLOUD_SECRETKEY
});

const db = app.database();
const collections = ['excel_records', 'excel_cache', 'patients', 'patient_intake_records'];

async function verifyCollection(collectionName) {
  try {
    const collection = db.collection(collectionName);
    const countResult = await collection.count();
    const total = countResult.total || 0;

    console.log(`\n📋 集合: ${collectionName}`);
    console.log(`  总记录数: ${total}`);

    if (total === 0) {
      console.log(`  ⚠️  集合为空`);
      return { name: collectionName, total: 0, samples: [] };
    }

    // 获取样本数据
    const sampleResult = await collection.limit(3).get();
    const samples = sampleResult.data || [];

    console.log(`  样本记录数: ${samples.length}`);

    // 显示关键字段
    samples.forEach((record, index) => {
      console.log(`  样本 ${index + 1}:`);

      if (collectionName === 'excel_records') {
        console.log(`    - 患者姓名: ${record.patientName || 'N/A'}`);
        console.log(`    - 入院日期: ${record.admissionDate || 'N/A'}`);
        console.log(`    - 医院: ${record.hospital || 'N/A'}`);
        console.log(`    - 诊断: ${record.diagnosis || 'N/A'}`);
      } else if (collectionName === 'patients') {
        console.log(`    - 患者姓名: ${record.patientName || 'N/A'}`);
        console.log(`    - 入院次数: ${record.admissionCount || 0}`);
        console.log(`    - 首次诊断: ${record.firstDiagnosis || 'N/A'}`);
        console.log(`    - 最新诊断: ${record.latestDiagnosis || 'N/A'}`);
      }
    });

    return {
      name: collectionName,
      total,
      samples: samples.map(record => ({
        _id: record._id,
        key: record.patientName || record.key || record._id
      }))
    };

  } catch (error) {
    console.error(`❌ 验证集合 ${collectionName} 失败:`, error.message);
    return { name: collectionName, total: 'error', error: error.message };
  }
}

async function verifyDataConsistency(results) {
  console.log('\n🔍 数据一致性检查:');

  const excelRecords = results.find(r => r.name === 'excel_records');
  const patients = results.find(r => r.name === 'patients');
  const intakeRecords = results.find(r => r.name === 'patient_intake_records');
  const cache = results.find(r => r.name === 'excel_cache');

  // 检查患者数量一致性
  if (patients && intakeRecords) {
    if (patients.total === intakeRecords.total) {
      console.log(`  ✅ 患者记录与入住记录数量一致: ${patients.total}`);
    } else {
      console.log(`  ⚠️  患者记录(${patients.total})与入住记录(${intakeRecords.total})数量不一致`);
    }
  }

  // 检查缓存
  if (cache && cache.total > 0) {
    console.log(`  ✅ 缓存数据已生成: ${cache.total} 个文档`);
  } else {
    console.log(`  ⚠️  缓存数据缺失或为空`);
  }

  // 检查原始数据
  if (excelRecords && excelRecords.total > 0) {
    console.log(`  ✅ Excel原始数据已导入: ${excelRecords.total} 条记录`);
  } else {
    console.log(`  ❌ Excel原始数据缺失`);
  }
}

async function verifyAll() {
  console.log('🔍 开始验证数据库完整性...');

  const results = [];
  for (const collectionName of collections) {
    const result = await verifyCollection(collectionName);
    results.push(result);
  }

  await verifyDataConsistency(results);

  console.log('\n📊 验证总结:');
  results.forEach(result => {
    if (typeof result.total === 'number') {
      console.log(`  - ${result.name}: ${result.total} 条记录`);
    } else {
      console.log(`  - ${result.name}: ${result.total} (${result.error})`);
    }
  });

  console.log('\n🎉 数据库验证完成！');
  return results;
}
```

#### 4.2 执行验证

```bash
# 验证数据完整性
TCB_ENV=cloud1-6g2fzr5f7cf51e38 \
TENCENTCLOUD_SECRETID=your_secret_id \
TENCENTCLOUD_SECRETKEY=your_secret_key \
node verify-data.js
```

**预期输出示例：**
```
🔍 开始验证数据库完整性...

📋 集合: excel_records
  总记录数: 243
  样本记录数: 3
  样本 1:
    - 患者姓名: 胡矩豪
    - 入院日期: 2020-06-03
    - 医院: 广西自治区人民医院
    - 诊断: 急性淋巴细胞白血病阳性

📋 集合: patients
  总记录数: 69
  样本记录数: 3
  样本 1:
    - 患者姓名: 胡矩豪
    - 入院次数: 7
    - 首次诊断: 急性淋巴细胞白血病阳性
    - 最新诊断: 急性淋巴细胞白血病

🔍 数据一致性检查:
  ✅ 患者记录与入住记录数量一致: 69
  ✅ 缓存数据已生成: 1 个文档
  ✅ Excel原始数据已导入: 243 条记录

📊 验证总结:
  - excel_records: 243 条记录
  - excel_cache: 1 条记录
  - patients: 69 条记录
  - patient_intake_records: 69 条记录

🎉 数据库验证完成！
```

### 第五阶段：云函数更新和缓存清理

#### 5.1 部署相关云函数

```bash
# 部署patientProfile云函数确保最新功能
"C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" cloud functions deploy \
  --env cloud1-6g2fzr5f7cf51e38 \
  --names patientProfile \
  --project "C:\Users\86152\work\test01"
```

#### 5.2 清理缓存

```javascript
// clear-cache.js
async function clearCache() {
  const db = app.database();
  const cacheCollection = db.collection('excel_cache');

  // 删除缓存文档
  await cacheCollection.doc('default').remove().catch(() => {});
  await cacheCollection.doc('patients_summary_cache').remove().catch(() => {});

  // 强制刷新
  const result = await app.callFunction({
    name: 'patientProfile',
    data: {
      action: 'list',
      forceRefresh: true,
      pageSize: 5
    }
  });

  console.log('✅ 缓存清理完成，数据已刷新');
  return result;
}
```

## 🔧 故障排除

### 常见错误及解决方案

#### 1. 云函数调用超时

**错误信息：** `ESOCKETTIMEDOUT`

**解决方案：**
- 检查网络连接稳定性
- 增加超时时间设置
- 分批处理大量数据

#### 2. 权限不足

**错误信息：** `permission denied` 或 `unauthorized`

**解决方案：**
```bash
# 检查环境变量设置
echo $TCB_ENV
echo $TENCENTCLOUD_SECRETID

# 验证API密钥权限
# 确保密钥具有CloudBase完整权限
```

#### 3. Excel文件读取失败

**错误信息：** `INVALID_EXCEL_FILE_ID`

**解决方案：**
```bash
# 检查文件ID设置
echo $EXCEL_FILE_ID

# 验证文件是否存在
# 在微信开发者工具的云存储中查看文件
```

#### 4. 数据同步不完整

**症状：** 部分字段缺失（如诊断信息）

**解决方案：**
```bash
# 重新同步患者数据
node -e "
const tcb = require('@cloudbase/node-sdk');
const app = tcb.init({
  env: process.env.TCB_ENV,
  secretId: process.env.TENCENTCLOUD_SECRETID,
  secretKey: process.env.TENCENTCLOUD_SECRETKEY
});

app.callFunction({
  name: 'readExcel',
  data: { action: 'syncPatients' }
}).then(result => {
  console.log('同步结果:', result.result);
});
"
```

### 数据一致性检查清单

| 检查项 | 预期结果 | 实际结果 | 状态 |
|--------|----------|----------|------|
| excel_records记录数 | 200+ | ___ | ⬜ |
| patients记录数 | 60+ | ___ | ⬜ |
| patient_intake_records记录数 | 与patients一致 | ___ | ⬜ |
| excel_cache文档数 | 1-2个 | ___ | ⬜ |
| 患者首次诊断信息完整性 | >80%有值 | ___ | ⬜ |
| 最新入院时间完整性 | >90%有值 | ___ | ⬜ |

## ✅ 验证清单

### 数据库层面验证

- [ ] 所有集合记录数量符合预期
- [ ] excel_records包含完整原始数据
- [ ] patients集合包含去重后的患者档案
- [ ] patient_intake_records与patients数量一致
- [ ] excel_cache已生成缓存数据

### 功能层面验证

- [ ] 患者列表页面正常加载
- [ ] 显示正确的最近入住时间
- [ ] 显示完整的首次诊断信息
- [ ] 患者详情页面数据完整
- [ ] 搜索和排序功能正常

### 性能层面验证

- [ ] 患者列表加载时间 < 3秒
- [ ] 缓存机制正常工作
- [ ] 分页功能正常
- [ ] 内存使用在合理范围

## 📝 完整操作记录模板

```
数据库重新初始化操作记录

操作时间: ____年__月__日 __:__
操作人员: ___________
操作原因: ___________

操作前状态:
- excel_records: ___ 条记录
- patients: ___ 条记录
- patient_intake_records: ___ 条记录
- excel_cache: ___ 条记录

执行步骤:
□ 1. 环境变量配置检查
□ 2. 数据备份（如需要）
□ 3. 数据库清空操作
□ 4. Excel数据重新导入
□ 5. 数据一致性验证
□ 6. 云函数部署更新
□ 7. 缓存清理操作
□ 8. 功能测试验证

操作后状态:
- excel_records: ___ 条记录
- patients: ___ 条记录
- patient_intake_records: ___ 条记录
- excel_cache: ___ 条记录

遇到的问题及解决方案:
_______________

验证结果:
□ 数据完整性 ✅/❌
□ 功能正常性 ✅/❌
□ 性能表现 ✅/❌

操作完成时间: ____年__月__日 __:__
总用时: ___ 分钟

备注:
_______________
```

## 📚 相关文档

- [项目README](../README.md)
- [云函数架构说明](../cloudfunctions/README.md)
- [数据库设计文档](./database-schema.md)
- [API接口文档](./api-reference.md)

---

*最后更新: 2025年9月30日*
*文档版本: v1.0.0*