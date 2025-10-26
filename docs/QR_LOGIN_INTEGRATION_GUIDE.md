# QR登录与权限系统集成指南

## 概述

本文档描述了QR登录系统与基于角色的访问控制(RBAC)系统的完整集成方案，支持多角色用户通过微信小程序扫码登录Web管理后台。

## 系统架构

### 核心组件

1. **QR登录云函数** (`cloudfunctions/qrLogin/`)
   - 生成登录二维码
   - 处理扫码确认
   - 管理登录会话

2. **Web端QR登录组件** (`web-admin/src/components/QRLoginModal.tsx`)
   - 显示二维码
   - 轮询登录状态
   - 处理登录成功/失败

3. **小程序端确认页面** (`wx-project/pages/qr-confirm/`)
   - 扫码解析
   - 角色选择
   - 登录确认

4. **权限控制系统**
   - RBAC上下文 (`RBACContext.tsx`)
   - 权限控制Hook (`usePermissionControl.ts`)
   - 数据过滤服务 (`dataFilterService.ts`)

## 支持的用户角色

### 角色定义

| 角色 | 权限级别 | 可访问功能 |
|------|----------|------------|
| `admin` | 系统管理员 | 所有功能 |
| `social_worker` | 社工 | 患者管理、数据分析、导出 |
| `volunteer` | 志愿者 | 查看患者、查看分析 |
| `parent` | 家长 | 查看自己孩子的信息 |
| `guest` | 游客 | 基础查看功能 |

### 权限矩阵

```
功能模块              | admin | social_worker | volunteer | parent | guest
---------------------|-------|---------------|-----------|--------|-------
查看仪表板            | ✓     | ✓             | ✓         | ✓      | ✓
患者列表              | ✓     | ✓             | ✓         | ✓      | ✓
患者详情              | ✓     | ✓             | ✓         | ✓      | ✗
编辑患者信息          | ✓     | ✓             | ✗         | ✗      | ✗
删除患者              | ✓     | ✗             | ✗         | ✗      | ✗
导出患者数据          | ✓     | ✓             | ✓         | ✗      | ✗
数据分析              | ✓     | ✓             | ✓         | ✗      | ✗
用户管理              | ✓     | ✗             | ✗         | ✗      | ✗
角色管理              | ✓     | ✗             | ✗         | ✗      | ✗
系统设置              | ✓     | ✗             | ✗         | ✗      | ✗
```

## QR登录流程

### 1. 生成二维码
```javascript
// Web端调用（生成二维码）
const result = await app.callFunction({
  name: 'qrLogin',
  data: { action: 'qrInit', type: 'admin' }
});

// 返回数据结构
{
  success: true,
  data: {
    qrData: "qrlogin://session/abc123?expires=1234567890",
    sessionId: "abc123",
    expiresAt: 1234567890
  }
}
```

### 2. 小程序扫码处理
```javascript
// 小程序端解析
const parseResult = await wx.cloud.callFunction({
  name: 'qrLogin',
  data: {
    action: 'parseQR',
    qrData: "qrlogin://session/abc123?expires=1234567890"
  }
});
```

### 3. 用户确认登录
```javascript
// 小程序端确认
const confirmResult = await wx.cloud.callFunction({
  name: 'qrLogin',
  data: {
    action: 'qrApprove',
    sessionId: "abc123",
    userInfo: {
      nickName: "用户名",
      avatarUrl: "头像URL",
      selectedRole: "social_worker"
    }
  }
});
```

### 4. Web端完成登录
```javascript
// Web端轮询获取结果
const loginResult = await app.callFunction({
  name: 'qrLogin',
  data: { action: 'qrStatus', sessionId: "abc123", nonce }
});

// 使用ticket登录
await auth.customAuthProvider().signInWithTicket(ticket);
```

## 数据过滤机制

### 基于角色的数据过滤

```typescript
// 使用权限控制Hook
const permissionControl = usePermissionControl();

// 过滤患者数据
const filteredPatients = permissionControl.filterPatientData(allPatients);

// 检查操作权限
const canDelete = permissionControl.canDeletePatient();
const canExport = permissionControl.canExportData();
```

### 数据访问规则

1. **admin**: 可访问所有数据
2. **social_worker**: 可访问本科室的患者数据
3. **volunteer**: 可访问分配给自己的患者数据
4. **parent**: 只能访问自己孩子的数据
5. **guest**: 只能访问公开的基础信息

## 组件集成

### 1. 受保护路由
```typescript
<ProtectedRoute requiredPermission="view_patients">
  <PatientListPage />
</ProtectedRoute>

<ProtectedRoute requireAdmin>
  <UserManagementPage />
</ProtectedRoute>
```

### 2. 基于角色的导航
```typescript
<RoleBasedNav
  items={DEFAULT_NAV_ITEMS}
  variant="sidebar"
  showLabels={true}
/>
```

### 3. 权限检查UI组件
```typescript
{permissionControl.canEditPatient() && (
  <Button onClick={handleEdit}>编辑</Button>
)}

{permissionControl.hasPermission('export_data') && (
  <Button onClick={handleExport}>导出</Button>
)}
```

## 测试策略

### 1. 单元测试
- 权限控制Hook测试
- 数据过滤服务测试
- QR登录组件测试

### 2. 集成测试
- 完整登录流程测试
- 权限验证测试
- 跨组件数据流测试

### 3. E2E测试
- 端到端登录测试
- 多角色权限测试
- 数据安全测试

### 测试命令
```bash
# 运行所有测试
npm test

# 运行集成测试
npm run test:integration

# 运行E2E测试
npm run test:e2e
```

## 部署配置

### 1. 环境变量
```env
# 云开发环境
WECHAT_MINIAPP_ID=your_app_id
TCB_ENV=your_cloud_env_id

# QR登录配置
QR_LOGIN_EXPIRE_TIME=90
QR_LOGIN_MAX_ATTEMPTS=3

# 安全配置
ENABLE_SESSION_MANAGEMENT=true
ENABLE_ROLE_VALIDATION=true
```

### 2. 云函数部署
```bash
# 部署QR登录云函数
npx tcb functions:deploy qrLogin

# 部署权限相关云函数
npx tcb functions:deploy rbac
npx tcb functions:deploy auth
```

### 3. 前端构建
```bash
# 构建Web管理端
cd web-admin
npm run build

# 构建小程序
cd wx-project
npm run build
```

## 安全考虑

### 1. 二维码安全
- 二维码有效期限制(90秒)
- 会话ID加密验证
- 防重放攻击机制

### 2. 权限验证
- 服务端权限验证
- 客户端权限缓存
- 权限变更实时同步

### 3. 数据保护
- 敏感数据脱敏
- 数据访问日志
- 异常访问检测

## 监控与日志

### 1. 登录监控
```typescript
// 登录成功日志
{
  type: 'login_success',
  userId: 'user_123',
  role: 'social_worker',
  timestamp: '2025-01-18T10:00:00Z',
  method: 'qr_code'
}
```

### 2. 权限监控
```typescript
// 权限拒绝日志
{
  type: 'permission_denied',
  userId: 'user_123',
  resource: 'patient_delete',
  action: 'delete',
  timestamp: '2025-01-18T10:00:00Z'
}
```

## 故障排除

### 常见问题

1. **二维码无法扫描**
   - 检查网络连接
   - 确认云函数部署状态
   - 验证环境配置

2. **登录失败**
   - 检查用户权限
   - 验证会话状态
   - 查看错误日志

3. **权限异常**
   - 清除本地缓存
   - 重新登录
   - 检查角色分配

### 调试工具
```javascript
// 开启调试模式
localStorage.setItem('DEBUG_PERMISSIONS', 'true');

// 查看当前权限
console.log(permissionControl.permissionSummary);

// 检查数据过滤
console.log(permissionControl.getDataFilters());
```

## 更新日志

### v1.0.0 (2025-01-18)
- 完整QR登录系统
- 多角色权限支持
- 数据过滤机制
- 集成测试覆盖

### 待实现功能
- 双因素认证
- 权限动态分配
- 审批工作流
- 移动端适配

---

更多详细信息请参考：
- [QR登录云函数文档](./cloud-functions/qr-login.md)
- [权限控制API文档](./api/permissions.md)
- [测试指南](./testing/qr-login-testing.md)
