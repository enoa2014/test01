# 患者管理业务组件 API 规范

## 概述
本文档汇总 Story 001.4 中业务组件所依赖的后端接口，约定请求/响应结构、错误码、版本管理与安全策略，供前端与后端协作参考。

## 版本与网关
- 基础路径：`/api/v1`（若接口升级需采用 `/api/v2` 并兼容旧版本）。
- 所有请求需携带身份凭证（如 `Authorization: Bearer <token>`）与租户信息（`X-Tenant-Id`）。
- 统一返回格式：
```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

## 1. 患者列表与基础信息
### `GET /api/v1/patients`
| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | Number | 页码，默认 1 |
| `pageSize` | Number | 每页数量，默认 20 |
| `keyword` | String | 搜索关键词 |
| `filters` | Object | 筛选条件 JSON（与 FilterPanel 匹配） |

**响应**
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "pat_001",
        "name": "李小明",
        "gender": "male",
        "age": 7,
        "status": "in_care",
        "riskLevel": "medium",
        "latestEvent": {
          "title": "巡房",
          "timestamp": "2025-09-22T10:30:00+08:00"
        }
      }
    ],
    "total": 256
  }
}
```

### `GET /api/v1/patients/:id`
返回患者详情，供 PatientForm/PatientCard 深度展示。

## 2. 搜索相关
### `GET /api/v1/search/patients`
| 参数 | 说明 |
|------|------|
| `keyword` | 关键字 |
| `scope` | 搜索范围（`basic`/`detail`） |
| `limit` | 返回条数，默认 10 |

**响应**：列表包含 `id`、`name`、`status`、`highlightText`。

### `GET /api/v1/search/suggestions`
返回热门词、个性化推荐。结构：
```json
{
  "code": 0,
  "data": {
    "recommend": ["高风险患者", "待补资质"],
    "recent": ["李小明"],
    "trending": ["白血病", "志愿者"]
  }
}
```

### `GET /api/v1/search/history`
返回最近 10 条。支持 `DELETE /api/v1/search/history` 清空。

## 3. 筛选方案
### `GET /api/v1/filters/patient/schema`
返回 FilterPanel 所需字段，示例参见组件文档。

### `GET /api/v1/filters/patient/presets`
返回预设列表：
```json
{
  "code": 0,
  "data": [
    {
      "id": "preset_recent",
      "name": "近7天入住",
      "value": {"admitRange": ["2025-09-16", "2025-09-22"]},
      "readonly": true
    }
  ]
}
```

### `POST /api/v1/filters/patient/presets`
请求体：`{ "name": "高风险待补资料", "value": {...} }`

## 4. 时间线
### `GET /api/v1/patients/:id/timeline`
| 参数 | 说明 |
|------|------|
| `page` / `pageSize` | 分页 |
| `types[]` | 事件类型数组 |
| `from` / `to` | 日期范围 |

响应字段与 Timeline 组件数据结构一致。

### `POST /api/v1/patients/:id/timeline`
新增事件，字段：`type`、`title`、`summary`、`timestamp`、`attachments`、`actorId`。

## 5. 指标与统计
### `GET /api/v1/dashboard/stats`
返回数组：
```json
[
  {
    "id": "in_care",
    "title": "在住患者",
    "value": 128,
    "unit": "人",
    "delta": 5,
    "deltaType": "absolute",
    "status": "normal"
  }
]
```

### `GET /api/v1/dashboard/trends`
返回 sparkline 数据：`{ "id": "in_care", "data": [10, 12, 14], "period": "7d" }`

### `GET /api/v1/dashboard/alerts`
返回告警列表：`[{ "id": "risk_high", "message": "高风险患者 12 人" }]`

## 6. 表单与草稿
### `POST /api/v1/patients`
创建患者，Body 对应 PatientForm 结构。

### `PUT /api/v1/patients/:id`
更新患者。

### `POST /api/v1/patients/:id/draft`
保存草稿。

## 7. 附件上传
### `POST /api/v1/patients/:id/files`
- 请求头需包含 `Content-Type: multipart/form-data`。
- 返回 `fileId`、`url`、`type`、`uploadedAt`。

### `DELETE /api/v1/patients/:id/files/:fileId`
删除附件。

## 8. 统一错误码
| code | 描述 | 组件处理建议 |
|------|------|--------------|
| 0 | 成功 | - |
| 400100 | 参数错误 | 显示表单校验错误 |
| 401000 | 未授权 | 跳转登录/提示权限 |
| 403000 | 权限不足 | 启用受限视图 |
| 404000 | 资源不存在 | 显示空状态 |
| 409000 | 冲突（重复数据） | 弹出提示并聚焦字段 |
| 429000 | 请求过于频繁 | 弹出节流提示 |
| 500000 | 服务异常 | 显示全局错误并提供重试 |

## 9. 安全与审计
- 对关键操作（编辑、删除、上传）记录审计日志：`POST /api/v1/audit/logs`。
- 支持幂等处理：`Idempotency-Key` 请求头。
- 所有 GET 请求建议支持 `If-Modified-Since` 缓存策略。

## 10. 性能指标
- 搜索接口响应时间 < 300ms。
- 时间线分页请求 < 500ms。
- 指标接口允许 60 秒缓存。

## 11. 回滚与兼容
- 新增字段需标记 `optional`，前端保持向后兼容。
- 版本升级提供 deprecation 文档，至少提前 2 个迭代通知。

## 附录
- 统一日期格式：ISO 8601（UTC+8）。
- 币种字段使用 `currency` + `amount`。
- 布尔值统一使用 `true/false`，禁止 0/1。
