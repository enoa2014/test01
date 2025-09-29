# 云函数架构重构说明

## 重构概述

本次重构将原本混合在 `readExcel` 中的患者档案业务功能独立成专门的云函数，实现职责分离和性能优化。

## 新架构设计

### 1. patientProfile 云函数 (新增)

**职责**: 专门处理前端业务的患者档案查询功能

**支持操作**:
- `list`: 获取患者列表，支持强制刷新
- `detail`: 根据患者key获取详细信息

**特性**:
- 30分钟智能缓存机制
- 分批读取大量数据
- 优化的患者分组算法
- 统一的错误处理

**数据来源**: `excel_records` 和 `excel_cache` 集合

### 2. readExcel 云函数 (重构)

**职责**: 专门处理Excel数据的初始化和同步工作

**支持操作**:
- `import`: 从Excel文件导入数据到 `excel_records` 集合
- `syncPatients`: 从 `excel_records` 同步数据到 `patients` 集合
- `test`: 测试Excel解析功能

**特性**:
- 移除了前端业务调用的 `list` 和 `detail` 操作
- 专注于数据处理和初始化
- 保留完整的Excel解析逻辑
- 维护数据同步功能

### 3. dashboardService 云函数 (新增)

**职责**: 仪表板数据服务和统计分析

**支持操作**:
- 提供仪表板数据聚合
- 统计分析功能

### 4. 其他云函数 (不变)

- **patientIntake**: 患者入住管理
- **patientMedia**: 患者媒体文件管理
- **helloWorld**: 测试函数

## 数据流架构

```
Excel文件 (云存储)
    ↓ readExcel(import)
excel_records 集合
    ↓ readExcel(syncPatients)
patients 集合
    ↑
patientIntake 云函数

excel_records 集合
    ↓ patientProfile(list/detail)
前端业务界面
```

## 前端调用更改

| 页面 | 原调用 | 新调用 | 说明 |
|------|--------|--------|------|
| `pages/index/index.js` | `readExcel.list` | `patientProfile.list` | 主页患者列表 |
| `pages/analysis/index.js` | `readExcel.list` | `patientProfile.list` | 数据分析页面 |
| `pages/patient-detail/detail.js` | `readExcel.detail` | `patientProfile.detail` | 患者详情页面 |
| `pages/patient-intake/select/select.js` | `readExcel.list` | `patientProfile.list` | 入住选择页面 |

## 优势分析

### 1. 职责分离
- **readExcel**: 专注数据初始化和同步
- **patientProfile**: 专注前端业务查询
- **patientIntake**: 专注入住流程管理

### 2. 性能优化
- 独立缓存策略 (30分钟有效期)
- 专用查询优化
- 分批数据读取
- 减少不必要的Excel解析操作

### 3. 维护简化
- 各云函数功能单一明确
- 降低代码耦合度
- 便于独立测试和调试
- 错误影响范围可控

### 4. 扩展性提升
- 便于添加新的患者档案功能
- 支持独立的性能调优
- 可以单独优化缓存策略
- 支持不同的访问权限控制

## 部署说明

### 部署状态 ✅ 已完成 (2025-09-25)

**部署顺序** (已执行):
1. ✅ 部署 `patientProfile` 云函数 (04:34:22)
2. ✅ 更新前端代码调用
3. ✅ 部署重构后的 `readExcel` 云函数 (04:35:58)
4. ✅ 验证功能完整性

**验证结果**:
1. ✅ 患者列表加载 - patientProfile.list 正常工作
2. ✅ 患者详情查看 - patientProfile.detail 正常工作
3. ✅ 数据分析功能 - 前端调用已更新
4. ✅ 入住选择功能 - 前端调用已更新
5. ✅ 数据同步流程 - readExcel 核心功能保留

## 注意事项

### 1. 数据兼容性
- 保持前端数据格式不变
- 确保所有字段正确映射
- 维护错误格式一致性

### 2. 缓存管理
- 30分钟缓存自动刷新
- 支持强制刷新参数
- 缓存失效时自动重建

### 3. 错误处理
- 统一错误码和消息格式
- 详细错误信息记录
- 优雅的降级机制

### 4. 性能监控
- 监控响应时间改善
- 追踪缓存命中率
- 观察资源使用情况

## 回滚方案

如果需要回滚到原架构：
1. 恢复 `readExcel/index.js.backup`
2. 还原前端调用为 `readExcel`
3. 删除 `patientProfile` 云函数

## 总结

本次重构实现了云函数职责的清晰分离，提升了系统的可维护性和性能。新架构为未来的功能扩展和优化提供了良好的基础。