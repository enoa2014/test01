# normalizeFromRaw接口执行指南

## 概述

本指南说明如何调用readExcel云函数的`normalizeFromRaw`接口来初始化数据库，解决患者管理页面无法获取数据的问题。

## 背景情况

- ✅ 数据库已清空（通过database:reinit脚本）
- ❌ Excel文件导入失败（网络超时）
- ✅ readExcel云函数已部署
- ✅ normalizeFromRaw接口可用

## 执行步骤

### 方法1: 浏览器控制台执行（推荐）

1. **访问Web管理端**
   ```
   http://127.0.0.1:5178
   ```

2. **登录系统**
   - 用户名: `admin`
   - 密码: `123456`

3. **打开开发者工具**
   - 按 `F12` 或右键 → "检查"
   - 切换到 `Console` 标签页

4. **执行JavaScript代码**

```javascript
async function callNormalizeFromRaw() {
  console.log('🎯 开始调用normalizeFromRaw接口...');

  try {
    // 检查CloudBase是否已初始化
    if (!window.cloudbaseApp) {
      console.error('❌ CloudBase未初始化，请先登录');
      return;
    }

    const app = window.cloudbaseApp;
    const syncBatchId = 'init-' + Date.now();

    console.log('📡 调用readExcel云函数...');
    console.log('📋 参数:', { action: 'normalizeFromRaw', syncBatchId });

    const result = await app.callFunction({
      name: 'readExcel',
      data: {
        action: 'normalizeFromRaw',
        syncBatchId: syncBatchId
      }
    });

    console.log('📊 云函数响应:', result.result);

    if (result.result && result.result.success) {
      console.log('✅ normalizeFromRaw调用成功！');
      console.log('📊 导入记录数:', result.result.imported?.inserted || 0);
      console.log('👥 患者数量:', result.result.totalPatients || 0);
      console.log('🔄 同步患者数:', result.result.sync?.patients || 0);

      // 刷新页面以获取新数据
      setTimeout(() => {
        console.log('🔄 3秒后刷新页面...');
        window.location.reload();
      }, 3000);

    } else {
      console.log('❌ normalizeFromRaw调用失败');
      console.log('错误信息:', result.result?.error);
    }

  } catch (error) {
    console.error('❌ 调用失败:', error);
  }
}

// 执行调用
callNormalizeFromRaw();
```

5. **执行调用**
   - 粘贴上述代码到控制台
   - 按 `Enter` 执行
   - 等待调用完成

### 方法2: 使用readExcel的import接口

如果normalizeFromRaw失败（显示RAW_DATA_EMPTY错误），可以尝试import接口：

```javascript
async function callImport() {
  try {
    const result = await window.cloudbaseApp.callFunction({
      name: 'readExcel',
      data: {
        action: 'import',
        fileId: 'cloud://cloud1-6g2fzr5f7cf51e38.636c-cloud1-6g2fzr5f7cf51e38-1375978325/data/b.xlsx'
      }
    });

    console.log('📊 Import结果:', result.result);

    if (result.result.success) {
      setTimeout(() => window.location.reload(), 3000);
    }
  } catch (error) {
    console.error('❌ Import失败:', error);
  }
}

callImport();
```

## 预期结果

### 成功响应示例
```javascript
{
  "success": true,
  "action": "normalizeFromRaw",
  "imported": {
    "inserted": 45
  },
  "totalPatients": 42,
  "sync": {
    "syncBatchId": "raw-1234567890",
    "patients": 42,
    "intakeRecords": 42,
    "errors": []
  }
}
```

### 执行成功后
- 数据库将包含患者数据
- 患者管理页面显示患者列表
- 搜索和筛选功能正常工作

## 故障排除

### 1. RAW_DATA_EMPTY错误
**错误信息**: `excel_raw_records 集合为空`

**解决方案**:
- 检查是否有原始Excel数据
- 使用import接口直接从Excel文件导入

### 2. NORMALIZED_EMPTY错误
**错误信息**: `未生成任何可导入的记录`

**解决方案**:
- 检查原始数据格式
- 确认数据包含必要的字段（患者姓名等）

### 3. 网络超时错误
**错误信息**: `ESOCKETTIMEDOUT` 或 `ECONNRESET`

**解决方案**:
- 重试几次
- 检查网络连接
- 考虑分批处理数据

### 4. 权限错误
**错误信息**: 云函数调用失败

**解决方案**:
- 确认用户已正确登录
- 检查用户权限
- 重新登录后重试

## 验证步骤

执行完成后：

1. **检查患者管理页面**
   - 访问: `http://127.0.0.1:5178/patients`
   - 应该显示患者列表而不是"没有找到匹配的记录"

2. **测试基本功能**
   - 搜索患者姓名
   - 使用筛选器
   - 查看患者详情

3. **检查Network请求**
   - 打开开发者工具Network标签
   - 确认patientProfile云函数调用成功
   - 返回数据包含患者记录

## 技术细节

### normalizeFromRaw接口功能
- 从`excel_raw_records`集合读取原始数据
- 规范化数据格式和字段
- 导入到`excel_records`集合
- 同步到`patients`和`patient_intake_records`集合
- 生成缓存数据

### 数据流程
```
excel_raw_records → normalize → excel_records → patients + patient_intake_records → cache
```

### 涉及的集合
- `excel_raw_records` - 原始Excel数据（源）
- `excel_records` - 规范化后的Excel数据
- `patients` - 患者主数据
- `patient_intake_records` - 患者入住记录
- `excel_cache` - 缓存数据

## 总结

normalizeFromRaw接口是解决当前数据缺失问题的最佳方案，因为它：

1. **不需要Excel文件** - 直接处理数据库中的原始数据
2. **完整的数据流程** - 从原始数据到最终用户数据的完整转换
3. **错误处理完善** - 提供详细的错误信息和处理
4. **自动同步** - 自动将数据同步到相关集合

执行成功后，患者管理功能将完全恢复正常。

---

**执行时间**: 2025-10-19
**接口**: readExcel.normalizeFromRaw
**目标**: 解决患者数据缺失问题