# 扫码登录系统API接口文档

## 1. 接口概述

### 1.1 基本信息
- **接口版本**: v1.0.0
- **基础URL**: `https://api.example.com/v1`
- **认证方式**: CloudBase Auth Ticket
- **数据格式**: JSON
- **字符编码**: UTF-8

### 1.1.1 本仓库落地映射（CloudBase 代理）
- 开发/本地环境下，web-admin 通过 Vite 中间件以 `/api/func/<function>` 形式代理云函数调用，实际请求体为 `{ data: {...} }`。
- 本仓库当前实现采用独立云函数 `qrLogin`（推荐）：`qrInit/qrStatus/qrApprove/qrCancel/parseQR`；如采用 `auth` 扩展 action 亦可，接口语义保持一致。
- 建议将本文档中的 REST 语义映射为云函数 action：
  - 生成二维码 → `POST /api/func/qrLogin`，`{ data: { action: 'qrInit', ... } }`（或 `auth`+`qrInit`）
  - 检查状态 → `POST /api/func/qrLogin`，`{ data: { action: 'qrStatus', sid, nonce } }`（或 `auth`+`qrStatus`）
  - 确认登录（小程序）→ `POST /api/func/qrLogin`，`{ data: { action: 'qrApprove', sid, ... } }`（或 `auth`+`qrApprove`）
- 生产环境可直接使用 CloudBase JS SDK 调用同名云函数，避免跨域问题。

### 1.2 通用响应格式
```json
{
  "success": true,
  "code": 200,
  "message": "操作成功",
  "data": {},
  "timestamp": 1705123456789,
  "requestId": "req_xxxxxxxxx"
}
```

### 1.3 错误响应格式
```json
{
  "success": false,
  "code": 400,
  "message": "请求参数错误",
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "参数验证失败",
    "details": {
      "field": "sessionId",
      "reason": "参数不能为空"
    }
  },
  "timestamp": 1705123456789,
  "requestId": "req_xxxxxxxxx"
}
```

### 1.4 状态码说明
| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权访问 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 409 | 资源冲突 |
| 410 | 资源已过期 |
| 429 | 请求频率超限 |
| 500 | 服务器内部错误 |
| 503 | 服务不可用 |

## 2. Web端接口

### 2.1 生成二维码接口

**接口地址**: `POST /qr-login/generate`（或 `POST /api/func/qrLogin` + `{ action: 'qrInit' }`）

**接口描述**: 生成扫码登录二维码

**请求参数**:
```json
{
  "type": "admin|social_worker|volunteer|parent|guest|multi",
  "deviceInfo": {
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "screenResolution": "1920x1080",
    "timezone": "Asia/Shanghai",
    "language": "zh-CN",
    "platform": "Win32",
    "colorDepth": 24
  },
  "metadata": {
    "source": "web_admin",
    "version": "1.0.0",
    "sessionId": "browser_session_id"
  },
  "roleFilters": {                    // 可选的角色过滤器
    "allowedRoles": ["admin", "social_worker", "volunteer", "parent", "guest"],
    "defaultRole": "admin"
  }
}
```

### 3.4 安全与幂等约束
- ticket 仅在 `confirmed/approved` 状态一次性下发，严禁在二维码与非必要响应中出现。
- `status` 查询在 ticket 下发后应返回 `consumed` 或不再返回 ticket 信息，避免重复登录。
- `nonce` 需与服务端 `nonceHash` 匹配并单次消费；服务端维护TTL与已用集合，防重放。
- 重要接口应包含请求节流/限流（如基于IP/会话），异常行为写入 `auditLogs`。

**响应数据**:
```json
{
  "success": true,
  "data": {
    "sessionId": "session_1705123456789_abc123",
    "qrData": "eyJzZXNzaW9uSWQiOiJzZXNzaW9uXzE3MDUxMjM0NTY3ODlfYWJjMTIzIiwidGltZXN0YW1wIjoxNzA1MTIzNDU2Nzg5LCJzaWduYXR1cmUiOiJhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5eiJ9",
    "nonce": "client_nonce_16bytes",
    "qrUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...", 
    "expiresAt": 1705127056789,
    "expiresIn": 90,
    "pollingInterval": 2000
  }
}
```

说明：
- 本仓库实现中，后端返回 `qrData`（加密的字符串），前端通过 `qrcode` 库生成二维码图片；`qrUrl` 为可选字段，可能为空。

**请求示例**:
```javascript
// REST 形态示例
const response = await fetch('/api/v1/qr-login/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Request-ID': generateRequestId()
  },
  body: JSON.stringify({
    type: 'admin',
    deviceInfo: {
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      colorDepth: screen.colorDepth
    },
    metadata: {
      source: 'web_admin',
      version: '1.0.0'
    }
  })
});

// CloudBase 代理示例（本仓库 web-admin 开发环境）
const cbResp = await fetch('/api/func/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: { action: 'qrInit', type: 'admin', metadata: { source: 'web_admin' } } })
});
const cbResult = await cbResp.json();

const result = await response.json();
```

### 2.2 检查二维码状态接口

**接口地址**: `POST /qr-login/status`（或 `POST /api/func/qrLogin` + `{ action: 'qrStatus' }`）

**接口描述**: 检查二维码扫描状态

**请求参数**:
```json
{
  "sessionId": "session_1705123456789_abc123",
  "nonce": "client_nonce_16bytes"
}
```

**响应数据 - 等待扫码状态**:
```json
{
  "success": true,
  "data": {
    "status": "pending",
    "message": "等待扫码...",
    "expiresAt": 1705127056789,
    "createdAt": 1705123456789,
    "nonce": "next_client_nonce"  
  }
}
```

**响应数据 - 已扫描状态**:
```json
{
  "success": true,
  "data": {
    "status": "scanned",
    "message": "已扫描，等待确认",
    "userInfo": {
      "nickName": "张三",
      "avatarUrl": "https://wx.qlogo.cn/...",
      "role": "admin",
      "loginMode": "full"
    },
    "scannedAt": 1705123466789,
    "expiresAt": 1705127056789
  }
}
```

**响应数据 - 已确认状态**:
```json
{
  "success": true,
  "data": {
    "status": "confirmed",
    "message": "登录成功",
    "loginTicket": "cloudbase_ticket_abc123",
    "nonce": "next_client_nonce",
    "userInfo": {
      "uid": "user_1705123456789",
      "username": "admin",
      "nickName": "张三",
      "role": "admin",
      "permissions": ["read", "write", "admin", "delete"],
      "avatarUrl": "https://wx.qlogo.cn/...",
      "loginMode": "full"
    },
    "sessionInfo": {
      "sessionId": "session_1705123456789_abc123",
      "loginMode": "full",
      "expiresAt": 1705127056789,
      "refreshToken": "refresh_token_xyz789"
    },
    "redirectTo": "/dashboard",
    "confirmedAt": 1705123476789
  }
}
```

**响应数据 - 已取消状态**:
```json
{
  "success": true,
  "data": {
    "status": "cancelled",
    "message": "用户取消登录",
    "reason": "user_cancelled",
    "cancelledAt": 1705123476789,
    "nonce": "next_client_nonce"
  }
}
```

**响应数据 - 已过期状态**:
```json
{
  "success": true,
  "data": {
    "status": "expired",
    "message": "二维码已过期",
    "expiredAt": 1705127056789
  }
}
```

说明：若请求携带了 `nonce` 并通过校验，响应会返回新的 `nonce`，用于后续一次轮询请求（可选增强）。

### 2.3 取消登录接口

**接口地址**: `POST /qr-login/cancel`（或 `POST /api/func/qrLogin` + `{ action: 'qrCancel' }`）

**接口描述**: 取消当前登录请求

**请求参数**:
```json
{
  "sessionId": "session_1705123456789_abc123",
  "reason": "user_cancelled|timeout|security"
}
```

**响应数据**:
```json
{
  "success": true,
  "data": {
    "cancelled": true,
    "message": "登录已取消",
    "reason": "用户取消登录"
  }
}
```

### 2.4 刷新二维码接口

**接口地址**: `POST /qr-login/refresh`（或 `POST /api/func/qrLogin` + `{ action: 'qrInit', refreshOf: sid }`）

**接口描述**: 刷新当前二维码

**请求参数**:
```json
{
  "sessionId": "session_1705123456789_abc123"
}
```

**响应数据**:
```json
{
  "success": true,
  "data": {
    "sessionId": "session_1705123466789_def456",
    "qrData": "eyJzZXNzaW9uSWQiOiJzZXNzaW9uXzE3MDUxMjM0NjY3ODlfZGVmNDU2Iiwi...",
    "qrUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "expiresAt": 1705127066789,
    "refreshCount": 1
  }
}
```

## 3. 小程序端接口

### 3.1 解析二维码接口

**接口地址**: `POST /qr-login/parse`（或由小程序本地解析 + 服务端 `qrStatus` 校验；本仓库为 `POST /api/func/qrLogin` + `{ action: 'parseQR' }`）

**接口描述**: 解析并验证二维码数据

**请求参数**:
```json
{
  "qrData": "eyJzZXNzaW9uSWQiOiJzZXNzaW9uXzE3MDUxMjM0NTY3ODlfYWJjMTIzIiwidGltZXN0YW1wIjoxNzA1MTIzNDU2Nzg5LCJzaWduYXR1cmUiOiJhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5eiJ9",
  "deviceInfo": {
    "platform": "iOS|Android",
    "system": "iOS 15.0|Android 12",
    "model": "iPhone 13|SM-G998B",
    "brand": "Apple|Samsung",
    "version": "8.0.0",
    "SDKVersion": "2.24.0"
  }
}
```

**响应数据 - 成功**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "sessionInfo": {
      "sessionId": "session_1705123456789_abc123",
      "type": "admin|guest",
      "status": "pending",
      "webDeviceInfo": {
        "ip": "192.168.1.100",
        "userAgent": "Mozilla/5.0...",
        "screenResolution": "1920x1080",
        "location": "北京市朝阳区"
      },
      "createdAt": 1705123456789,
    "expiresAt": 1705127056789
  },
  "approveNonce": "approve_nonce_16bytes",
  "securityInfo": {
    "riskLevel": "low",
    "warnings": []
  }
}
}
```

**响应数据 - 二维码无效**:
```json
{
  "success": false,
  "code": 400,
  "error": {
    "code": "INVALID_QR_CODE",
    "message": "二维码无效或已过期",
    "details": {
      "reason": "expired",
      "expiredAt": 1705127056789
    }
  }
}
```

### 3.2 确认登录接口

**接口地址**: `POST /qr-login/confirm`（或 `POST /api/func/qrLogin` + `{ action: 'qrApprove' }`）

**接口描述**: 确认登录请求

**请求参数**:
```json
{
  "sessionId": "session_1705123456789_abc123",
  "nonce": "client_nonce_16bytes",  
  "userInfo": {
    "openId": "ox1234567890abcdef",
    "unionId": "ux1234567890abcdef",
    "nickName": "张三",
    "avatarUrl": "https://wx.qlogo.cn/...",
    "gender": 1,
    "city": "北京",
    "province": "北京",
    "country": "中国"
  },
  "loginMode": "full|guest",
  "deviceInfo": {
    "platform": "iOS",
    "system": "iOS 15.0",
    "model": "iPhone 13",
    "brand": "Apple",
    "version": "8.0.0"
  },
  "securityToken": "security_token_abc123",
  "location": {
    "latitude": 39.9042,
    "longitude": 116.4074,
    "accuracy": 100
  }
}
```

说明：
- `approveNonce` 必填，由解析接口 `parse` 返回，用于防止跨会话或重放确认。
- `nonce` 为可选增强字段（请求级防重放）。

**响应数据 - 成功**:
```json
{
  "success": true,
  "data": {
    "confirmed": true,
    "message": "登录确认成功",
    "loginTicket": "cloudbase_ticket_abc123",
    "userInfo": {
      "uid": "user_1705123456789",
      "username": "admin",
      "role": "admin",
      "permissions": ["read", "write", "admin", "delete"],
      "loginMode": "full"
    },
    "sessionInfo": {
      "expiresAt": 1705127056789,
      "refreshToken": "refresh_token_xyz789"
    }
  }
}
```

**响应数据 - 权限不足**:
```json
{
  "success": false,
  "code": 403,
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "权限不足，无法执行此操作",
    "details": {
      "requiredRole": "admin",
      "currentRole": "guest"
    }
  }
}
```

### 3.3 获取用户权限接口

**接口地址**: `GET /qr-login/permissions`

**接口描述**: 获取当前用户的权限信息

**请求参数**: 无（需要通过CloudBase Auth认证）

**响应数据**:
```json
{
  "success": true,
  "data": {
    "userInfo": {
      "uid": "user_1705123456789",
      "openId": "ox1234567890abcdef",
      "nickName": "张三",
      "avatarUrl": "https://wx.qlogo.cn/...",
      "role": "admin",
      "loginMode": "full"
    },
    "permissions": {
      "pages": ["dashboard", "patient-list", "patient-detail", "analysis", "settings"],
      "actions": ["read", "write", "create", "edit", "delete", "export", "import"],
      "dataAccess": {
        "patientData": "full",
        "exportData": true,
        "deleteData": true,
        "editData": true
      }
    },
    "features": {
      "multiDeviceLogin": true,
      "dataExport": true,
      "userManagement": true,
      "systemSettings": true
    }
  }
}
```

## 4. 云函数接口

### 4.1 qrLogin云函数接口

#### 4.1.1 生成二维码云函数

**函数名**: `qrLogin`

**调用方式**:
```javascript
wx.cloud.callFunction({
  name: 'qrLogin',
  data: {
    action: 'generateQR',
    type: 'admin',
    deviceInfo: {
      userAgent: 'string',
      screenResolution: 'string',
      timezone: 'string'
    }
  }
})
```

**返回数据**:
```json
{
  "result": {
    "success": true,
    "data": {
      "sessionId": "session_1705123456789_abc123",
      "qrData": "encrypted_base64_string",
      "expiresAt": 1705127056789
    }
  }
}
```

#### 4.1.2 检查状态云函数

**调用方式**:
```javascript
wx.cloud.callFunction({
  name: 'qrLogin',
  data: {
    action: 'checkStatus',
    sessionId: 'session_1705123456789_abc123'
  }
})
```

**返回数据**:
```json
{
  "result": {
    "success": true,
    "data": {
      "status": "scanned",
      "userInfo": {
        "nickName": "张三",
        "avatarUrl": "https://wx.qlogo.cn/..."
      }
    }
  }
}
```

#### 4.1.3 确认登录云函数

**调用方式**:
```javascript
wx.cloud.callFunction({
  name: 'qrLogin',
  data: {
    action: 'confirmLogin',
    sessionId: 'session_1705123456789_abc123',
    loginMode: 'full',
    securityToken: 'security_token'
  }
})
```

**返回数据**:
```json
{
  "result": {
    "success": true,
    "data": {
      "confirmed": true,
      "loginTicket": "cloudbase_ticket_abc123"
    }
  }
}
```

### 4.2 auth云函数扩展接口

#### 4.2.1 验证票据云函数

**函数名**: `auth`

**调用方式**:
```javascript
wx.cloud.callFunction({
  name: 'auth',
  data: {
    action: 'verifyTicket',
    ticket: 'cloudbase_ticket_abc123'
  }
})
```

**返回数据**:
```json
{
  "result": {
    "success": true,
    "data": {
      "valid": true,
      "userInfo": {
        "uid": "user_1705123456789",
        "username": "admin",
        "role": "admin",
        "permissions": ["read", "write", "admin"]
      }
    }
  }
}
```

## 5. 管理接口

### 5.1 会话管理接口

#### 5.1.1 获取活跃会话列表

**接口地址**: `GET /admin/sessions`

**权限要求**: 管理员权限

**请求参数**:
```
?page=1&limit=20&status=active&type=admin
```

**响应数据**:
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "sessionId": "session_1705123456789_abc123",
        "type": "admin",
        "status": "active",
        "userInfo": {
          "nickName": "张三",
          "role": "admin"
        },
        "deviceInfo": {
          "ip": "192.168.1.100",
          "userAgent": "Mozilla/5.0..."
        },
        "createdAt": 1705123456789,
        "expiresAt": 1705127056789,
        "lastActivityAt": 1705123556789
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

#### 5.1.2 终止会话接口

**接口地址**: `POST /admin/sessions/{sessionId}/terminate`

**权限要求**: 管理员权限

**响应数据**:
```json
{
  "success": true,
  "data": {
    "terminated": true,
    "message": "会话已终止"
  }
}
```

### 5.2 统计分析接口

#### 5.2.1 获取登录统计

**接口地址**: `GET /admin/statistics/login`

**权限要求**: 管理员权限

**请求参数**:
```
?startDate=2024-01-01&endDate=2024-01-31&groupBy=day
```

**响应数据**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalLogins": 1250,
      "adminLogins": 800,
      "guestLogins": 450,
      "successRate": 0.92,
      "avgSessionDuration": 1800
    },
    "dailyStats": [
      {
        "date": "2024-01-13",
        "totalLogins": 45,
        "adminLogins": 30,
        "guestLogins": 15,
        "successRate": 0.95
      }
    ],
    "peakHours": [
      { "hour": 9, "count": 85 },
      { "hour": 14, "count": 120 },
      { "hour": 16, "count": 95 }
    ]
  }
}
```

#### 5.2.2 获取安全统计

**接口地址**: `GET /admin/statistics/security`

**权限要求**: 管理员权限

**响应数据**:
```json
{
  "success": true,
  "data": {
    "securityEvents": {
      "totalSuspiciousActivities": 15,
      "blockedIPs": 8,
      "failedAuthAttempts": 45,
      "replayAttacksPrevented": 3
    },
    "riskLevels": {
      "low": 120,
      "medium": 25,
      "high": 5
    },
    "recentEvents": [
      {
        "timestamp": 1705123456789,
        "type": "suspicious_activity",
        "severity": "medium",
        "description": "来自异常IP的登录尝试",
        "ip": "192.168.1.100",
        "sessionId": "session_abc123"
      }
    ]
  }
}
```

## 6. 错误码说明

### 6.1 通用错误码

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| INVALID_PARAMETER | 请求参数无效 | 检查参数格式和必填项 |
| MISSING_PARAMETER | 缺少必填参数 | 补充缺失的参数 |
| INVALID_FORMAT | 参数格式错误 | 按照要求格式化参数 |
| RATE_LIMIT_EXCEEDED | 请求频率超限 | 降低请求频率 |
| INTERNAL_ERROR | 服务器内部错误 | 稍后重试或联系技术支持 |

### 6.2 业务错误码

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| QR_CODE_EXPIRED | 二维码已过期 | 重新生成二维码 |
| QR_CODE_INVALID | 二维码无效 | 检查二维码来源 |
| SESSION_NOT_FOUND | 会话不存在 | 重新发起登录流程 |
| SESSION_EXPIRED | 会话已过期 | 重新发起登录流程 |
| ALREADY_CONFIRMED | 会话已确认 | 使用已确认的会话或重新发起 |
| ALREADY_CANCELLED | 会话已取消 | 重新发起登录流程 |
| USER_NOT_FOUND | 用户不存在 | 检查用户登录状态 |
| INSUFFICIENT_PERMISSIONS | 权限不足 | 联系管理员申请权限 |
| REPLAY_DETECTED | 检测到重放攻击 | 检查安全性，联系管理员 |
| DEVICE_NOT_TRUSTED | 设备不受信任 | 在受信任设备上操作 |
| SECURITY_CHECK_FAILED | 安全检查失败 | 检查网络环境和设备状态 |

### 6.3 网络错误码

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| NETWORK_ERROR | 网络连接错误 | 检查网络连接 |
| TIMEOUT_ERROR | 请求超时 | 检查网络状况，重试请求 |
| DNS_ERROR | DNS解析失败 | 检查网络设置 |
| SSL_ERROR | SSL证书错误 | 检查证书配置或联系管理员 |

## 7. 接口调用示例

### 7.1 Web端完整登录流程示例

```javascript
class QRLoginManager {
  constructor() {
    this.pollingInterval = null;
    this.sessionId = null;
  }

  // 1. 生成二维码
  async generateQRCode(type = 'admin') {
    try {
      const response = await fetch('/api/v1/qr-login/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': this.generateRequestId()
        },
        body: JSON.stringify({
          type,
          deviceInfo: this.getDeviceInfo(),
          metadata: {
            source: 'web_admin',
            version: '1.0.0'
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        this.sessionId = result.data.sessionId;
        this.startPolling();
        return result.data;
      } else {
        throw new Error(result.error.message);
      }
    } catch (error) {
      console.error('生成二维码失败:', error);
      throw error;
    }
  }

  // 2. 开始状态轮询
  startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
      try {
        await this.checkStatus();
      } catch (error) {
        console.error('状态检查失败:', error);
      }
    }, 2000);
  }

  // 3. 检查登录状态
  async checkStatus() {
    if (!this.sessionId) return;

    try {
      const response = await fetch('/api/v1/qr-login/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.sessionId
        })
      });

      const result = await response.json();

      if (result.success) {
        const { status } = result.data;

        switch (status) {
          case 'confirmed':
            this.stopPolling();
            this.handleLoginSuccess(result.data);
            break;
          case 'cancelled':
          case 'expired':
            this.stopPolling();
            this.handleLoginFailed(result.data);
            break;
          case 'scanned':
            this.updateUI('scanned', result.data.userInfo);
            break;
        }
      }
    } catch (error) {
      console.error('检查状态失败:', error);
    }
  }

  // 4. 处理登录成功
  handleLoginSuccess(data) {
    const { loginTicket, userInfo } = data;

    // 使用票据进行CloudBase登录
    this.loginWithTicket(loginTicket, userInfo);
  }

  // 5. 使用票据登录
  async loginWithTicket(ticket, userInfo) {
    try {
      // 调用现有的CloudBase登录逻辑
      const app = tcb.init({
        env: 'your-env-id'
      });

      const auth = app.auth();
      await auth.customAuthProvider().signInWithTicket(ticket);

      // 登录成功，跳转到管理后台
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('票据登录失败:', error);
      this.showError('登录失败，请重试');
    }
  }

  // 6. 获取设备信息
  getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      colorDepth: screen.colorDepth
    };
  }

  // 7. 生成请求ID
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 8. 停止轮询
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // 9. 取消登录
  async cancelLogin() {
    this.stopPolling();

    if (this.sessionId) {
      try {
        await fetch('/api/v1/qr-login/cancel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionId: this.sessionId,
            reason: 'user_cancelled'
          })
        });
      } catch (error) {
        console.error('取消登录失败:', error);
      }
    }
  }
}

// 使用示例
const qrLogin = new QRLoginManager();

// 生成二维码
document.getElementById('generate-qr').addEventListener('click', async () => {
  try {
    const qrData = await qrLogin.generateQRCode('admin');
    document.getElementById('qr-code').src = qrData.qrUrl;
    document.getElementById('status').textContent = '请使用微信小程序扫码';
  } catch (error) {
    document.getElementById('error').textContent = error.message;
  }
});

// 取消登录
document.getElementById('cancel-login').addEventListener('click', () => {
  qrLogin.cancelLogin();
});
```

### 7.2 小程序端完整登录流程示例

```javascript
// pages/scan-confirm/scan-confirm.js
Page({
  data: {
    sessionInfo: null,
    userInfo: null,
    loginMode: 'full',
    loading: false,
    error: ''
  },

  // 1. 扫描二维码
  scanQRCode() {
    wx.scanCode({
      onlyFromCamera: true,
      success: (res) => {
        console.log('扫码结果:', res.result);
        this.handleScanResult(res.result);
      },
      fail: (err) => {
        console.error('扫码失败:', err);
        this.setData({ error: '扫码失败，请重试' });
        wx.showToast({
          title: '扫码失败',
          icon: 'none'
        });
      }
    });
  },

  // 2. 处理扫码结果
  async handleScanResult(qrData) {
    this.setData({ loading: true, error: '' });

    try {
      // 解析二维码
      const parseResult = await this.parseQRCode(qrData);

      if (parseResult.success) {
        this.setData({
          sessionInfo: parseResult.data.sessionInfo
        });

        // 获取当前用户信息
        const userInfo = await this.getCurrentUserInfo();
        this.setData({ userInfo });

        // 根据用户角色确定登录模式
        const loginMode = this.determineLoginMode(userInfo);
        this.setData({ loginMode });

      } else {
        this.setData({ error: parseResult.error.message });
      }
    } catch (error) {
      console.error('处理扫码结果失败:', error);
      this.setData({ error: '处理失败，请重试' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 3. 解析二维码
  async parseQRCode(qrData) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'qrLogin',
        data: {
          action: 'parse',
          qrData,
          deviceInfo: this.getDeviceInfo()
        }
      }).then(res => {
        if (res.result.success) {
          resolve(res.result);
        } else {
          reject(new Error(res.result.error.message));
        }
      }).catch(err => {
        reject(err);
      });
    });
  },

  // 4. 获取当前用户信息
  async getCurrentUserInfo() {
    return new Promise((resolve, reject) => {
      wx.getUserInfo({
        success: (res) => {
          resolve(res.userInfo);
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  },

  // 5. 确定登录模式
  determineLoginMode(userInfo) {
    // 根据用户角色确定登录模式
    // 管理员可以选择完整登录或游客模式
    // 普通用户只能选择相应的模式
    const app = getApp();
    const userRole = app.getUserRole();

    if (userRole === 'admin') {
      return 'full'; // 默认完整登录
    } else {
      return 'guest'; // 游客模式
    }
  },

  // 6. 确认登录
  async confirmLogin() {
    const { sessionInfo, userInfo, loginMode } = this.data;

    if (!sessionInfo) {
      wx.showToast({
        title: '请先扫码',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });

    try {
      const result = await this.confirmQRLogin(
        sessionInfo.sessionId,
        loginMode,
        userInfo
      );

      if (result.success) {
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });

        // 延迟返回
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);

      } else {
        this.setData({ error: result.error.message });
      }
    } catch (error) {
      console.error('确认登录失败:', error);
      this.setData({ error: '确认失败，请重试' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 7. 确认二维码登录
  async confirmQRLogin(sessionId, loginMode, userInfo) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'qrLogin',
        data: {
          action: 'confirmLogin',
          sessionId,
          loginMode,
          userInfo,
          deviceInfo: this.getDeviceInfo(),
          securityToken: this.generateSecurityToken(),
          location: await this.getCurrentLocation()
        }
      }).then(res => {
        resolve(res.result);
      }).catch(err => {
        reject(err);
      });
    });
  },

  // 8. 取消登录
  async cancelLogin() {
    const { sessionInfo } = this.data;

    if (sessionInfo) {
      try {
        await wx.cloud.callFunction({
          name: 'qrLogin',
          data: {
            action: 'cancelLogin',
            sessionId: sessionInfo.sessionId,
            reason: 'user_cancelled'
          }
        });
      } catch (error) {
        console.error('取消登录失败:', error);
      }
    }

    wx.navigateBack();
  },

  // 9. 获取设备信息
  getDeviceInfo() {
    const systemInfo = wx.getSystemInfoSync();
    return {
      platform: systemInfo.platform,
      system: systemInfo.system,
      model: systemInfo.model,
      brand: systemInfo.brand,
      version: systemInfo.version,
      SDKVersion: systemInfo.SDKVersion
    };
  },

  // 10. 生成安全令牌
  generateSecurityToken() {
    return `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  // 11. 获取当前位置
  async getCurrentLocation() {
    return new Promise((resolve) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          resolve({
            latitude: res.latitude,
            longitude: res.longitude,
            accuracy: res.accuracy
          });
        },
        fail: () => {
          resolve(null);
        }
      });
    });
  },

  // 12. 切换登录模式
  switchLoginMode() {
    const { loginMode } = this.data;
    const newMode = loginMode === 'full' ? 'guest' : 'full';
    this.setData({ loginMode: newMode });
  }
});
```

### 7.3 错误处理示例

```javascript
// 统一错误处理
class ApiErrorHandler {
  static handle(error, context = '') {
    console.error(`API错误 [${context}]:`, error);

    let message = '操作失败，请重试';
    let code = 'UNKNOWN_ERROR';

    if (error.response) {
      // HTTP错误响应
      const { status, data } = error.response;

      switch (status) {
        case 400:
          message = '请求参数错误';
          code = data.error?.code || 'BAD_REQUEST';
          break;
        case 401:
          message = '未授权，请重新登录';
          code = 'UNAUTHORIZED';
          break;
        case 403:
          message = '权限不足';
          code = 'FORBIDDEN';
          break;
        case 404:
          message = '资源不存在';
          code = 'NOT_FOUND';
          break;
        case 429:
          message = '请求过于频繁，请稍后重试';
          code = 'RATE_LIMITED';
          break;
        case 500:
          message = '服务器内部错误';
          code = 'INTERNAL_ERROR';
          break;
        default:
          message = data.error?.message || message;
          code = data.error?.code || code;
      }
    } else if (error.request) {
      // 网络错误
      message = '网络连接失败，请检查网络';
      code = 'NETWORK_ERROR';
    } else {
      // 其他错误
      message = error.message || message;
      code = error.code || code;
    }

    return { message, code, originalError: error };
  }

  static async retry(apiCall, maxRetries = 3, delay = 1000) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;

        // 如果是客户端错误（4xx），不重试
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          throw error;
        }

        // 等待后重试
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    }

    throw lastError;
  }
}

// 使用示例
async function generateQRCodeWithRetry() {
  try {
    const result = await ApiErrorHandler.retry(async () => {
      const response = await fetch('/api/v1/qr-login/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'admin' })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    });

    return result;
  } catch (error) {
    const { message, code } = ApiErrorHandler.handle(error, 'generateQRCode');
    throw new Error(message);
  }
}
```

这个API接口文档提供了扫码登录系统的完整接口规范，包括Web端、小程序端、云函数和管理接口的详细说明，以及完整的调用示例和错误处理方案。这将为前后端开发提供清晰的接口规范指导。
