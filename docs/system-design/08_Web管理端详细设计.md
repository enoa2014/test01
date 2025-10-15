# Web 管理端详细设计（不编码）

本详细设计在《07_Web管理端设计.md》的基础上，给出页面规格、接口契约（云函数 action 级）、数据模型字段、流程时序、权限与审计策略、错误码、测试与验收标准。仅设计与分析，不涉及编码实现。

## 0. 约束与前提
- 单机构模型，RBAC 角色：`admin`、`social_worker`、`volunteer`、`parent`、`guest`。
- 管理端访问：仅 `admin | social_worker` 可登录；`social_worker` 不得管理管理员。
- 认证：CloudBase 自定义登录（auth 云函数签发 ticket，JS SDK `customAuthProvider().signInWithTicket`）。
- 数据源：复用云数据库及现有业务集合；在必要处新增最小集合（如 `import_jobs`/`export_jobs`）。
- 返回结构：统一 `{ success, data?, error? }`。

---

## 1. 页面规格（UI/交互/字段）

### 1.1 登录 Login `/login`
- 表单：`username`、`password`。
- 行为：提交 → 调 `auth.login` → 成功后初始化 CloudBase 登录态并跳转 `/`。
- 失败：`USER_NOT_FOUND`、`BAD_PASSWORD`、`ALREADY_INITIALIZED`（仅 seed 用）；提示人类可读信息。
- 安全：不记住明文；支持退出清理状态。

### 1.2 概览 Dashboard `/`
- 指标卡：
  - 待审批数（`roleRequests` state=pending）
  - 近 7 日导入条数、导出次数（取 `auditLogs` 或 `import_jobs/export_jobs` 聚合）
  - 异常日志计数（`auditLogs` level=warn|error 或 `error` code != null）
- 快捷入口：去审批、创建邀请、导入 Excel、查看审计。
- 权限：`admin|social_worker`。

### 1.3 用户管理 Users `/users`
- 列表字段：头像、姓名/昵称、手机号、openid（缩略）、最近登录时间、状态（active/suspended）、角色概览（active 绑定聚合）。
- 过滤：关键字（姓名/手机号/openid）、角色、多选状态、时间范围（创建/登录）。
- 操作：查看详情（抽屉），禁用/启用用户（admin 专属），查看角色绑定（只读）。
- 权限：`admin`（全量）、`social_worker`（只读）。

### 1.4 角色绑定 Role Bindings `/roles`
- 列表：用户、角色、scopeType（V1 固定 global）、state（active）、绑定时间、备注。
- 动作：授予/回收 `social_worker|volunteer|parent`，不可变更/移除 `admin`。
- 批量：支持多选批量回收。
- 二次确认：变更角色需确认弹窗并写审计。
- 权限：授予/回收仅 `admin`；`social_worker` 只读（可选开关：允许社工操作 `volunteer|parent`）。

### 1.5 申请审批 Approvals `/approvals`
- 场景：志愿者/家长升级申请（V1.5 可扩展联系方式访问 `accessGrants`）。
- 列表：申请人、申请角色、提交时间、材料摘要/附件数、当前状态（pending/approved/rejected）。
- 详情：基本信息、材料预览、历史变更、操作区（通过/驳回，填写理由）。
- 权限：`admin|social_worker`；通过后写入 `roleBindings`。

### 1.6 邀请管理 Invites `/invites`
- 创建邀请：角色（志愿者/家长）、可用次数、有效期（天/截止时间）、备注、（可选）关联患者 ID（家长用）。
- 列表：邀请码、角色、创建人、创建时间、有效期、剩余次数、使用记录。
- 动作：作废（revoke）。
- 权限：`admin|social_worker`。

### 1.7 导入 Excel Import `/import`
- Step1：选择文件（本地上传到云存储或输入 FileID）。
- Step2：解析预览（sheet 名、列头、样本 20 行；映射检查结果与警告）。
- Step3：执行导入（模式：智能合并/仅新增/仅更新；并发与批量大小可选）；显示进度条。
- 结果：成功/失败条数，错误明细可下载；生成 `import_jobs` 记录。
- 权限：`admin` 默认；`social_worker` 依赖设置开关。

### 1.8 导出中心 Export `/export`
- 过滤：患者筛选条件（性别/状态/籍贯/关键词等）。
- 字段策略：管理员可全字段；社工默认脱敏（身份证/地址/联系方式按策略隐藏）。
- 水印：导出人/时间戳/范围写入文件名与表头。
- 结果：异步任务，生成 `export_jobs` 记录，完成后提供下载链接（临时 URL）。
- 权限：`admin`、`social_worker`（明细导出）。

### 1.9 审计日志 Audit `/audit`
- 过滤：时间、操作者、动作（`patient.update`/`export.detail`/`role.approve` 等）、目标类型/ID、级别。
- 列表：时间、操作者、动作、摘要、目标、详情按钮。
- 详情：完整记录 JSON 视图。
- 权限：`admin` 全量；`social_worker` 只读。

### 1.10 系统设置 Settings `/settings`
- 环境信息：envId、函数健康探测（心跳 action）、存储使用量。
- 安全策略：导出脱敏开关（仅管理员）、`social_worker` 是否允许导入。
- 会话：刷新登录态、登出。

---

## 2. 云函数接口契约（Action 级）

说明：以下是推荐 action 及入参/出参格式。最终以实现为准，但必须遵循统一响应结构与错误码。

### 2.1 auth（已有）
- `seedAdmin`
  - req: `{ action: 'seedAdmin', code, username, password }`
  - res: `{ success, adminId? } | { success:false, error }`
- `login`
  - req: `{ action: 'login', username, password }`
  - res: `{ success, ticket, user: { id, username, role } }`

### 2.2 rbac（新增）
- `getCurrentUser`
  - req: `{ action:'getCurrentUser' }`
  - res: `{ success, data:{ userId, openid, roles:string[], displayName?, avatar?, lastLoginAt? } }`
- `listUsers`
  - req: `{ action:'listUsers', page, pageSize, keyword?, roles?, status?, timeRange? }`
  - res: `{ success, data:{ items:User[], total } }`
- `listRoleBindings`
  - req: `{ action:'listRoleBindings', userOpenId? }`
  - res: `{ success, data:{ items:RoleBinding[] } }`
- `addRoleBinding`
  - 权限：`admin`（或设置允许社工对非管理员）
  - req: `{ action:'addRoleBinding', userOpenId, role, expiresAt? }`
  - res: `{ success }`
- `removeRoleBinding`
  - req: `{ action:'removeRoleBinding', userOpenId, role }`
  - res: `{ success }`
- `listRoleRequests`
  - req: `{ action:'listRoleRequests', state?, page?, pageSize? }`
  - res: `{ success, data:{ items:RoleRequest[], total } }`
- `approveRoleRequest`
  - req: `{ action:'approveRoleRequest', requestId, reason? }`
  - res: `{ success }`
- `rejectRoleRequest`
  - req: `{ action:'rejectRoleRequest', requestId, reason }`
  - res: `{ success }`
- `createInvite`
  - req: `{ action:'createInvite', role, uses:number, expiresAt?:number, patientId?:string, note?:string }`
  - res: `{ success, data:{ code, inviteId } }`
- `revokeInvite`
  - req: `{ action:'revokeInvite', inviteId }`
  - res: `{ success }`
- `listInvites`
  - req: `{ action:'listInvites', page?, pageSize?, role?, state? }`
  - res: `{ success, data:{ items:Invite[], total } }`

### 2.3 patientProfile（既有，需加鉴权）
- `list`
  - req: `{ action:'list', page?, pageSize?, keyword?, filters? }`
  - res: `{ success, patients:[...], totalCount, hasMore, nextPage }`
- `detail`
  - req: `{ action:'detail', key|patientKey }`
  - res: `{ success, ...patientDetail }`
- `create`
  - req: `{ action:'create', data: PatientPayload }`
  - res: `{ success, patientKey }`
- `update`
  - req: `{ action:'update', patientKey, patch: PatientPatch }`
  - res: `{ success, updatedAt }`
- `export`
  - req: `{ action:'export', filters, fieldsPolicy? }`
  - res: `{ success, data:{ jobId } }`（推荐异步化）

### 2.4 readExcel（既有/增强）
- `parse`
  - req: `{ action:'parse', fileId? }`
  - res: `{ success, data:{ sheetName, headers, subHeaders, sampleRows:RowPreview[], warnings?:string[] } }`
- `import`
  - req: `{ action:'import', fileId, mode:'smart'|'createOnly'|'updateOnly' }`
  - res: `{ success, data:{ jobId } }`
- `listJobs`
  - req: `{ action:'listJobs', page?, pageSize? }`
  - res: `{ success, data:{ items:ImportJob[], total } }`
- `getJob`
  - req: `{ action:'getJob', jobId }`
  - res: `{ success, data:ImportJob }`

### 2.5 audit（新增）
- `listLogs`
  - req: `{ action:'listLogs', filters:{ actor?, action?, targetType?, from?, to? }, page?, pageSize? }`
  - res: `{ success, data:{ items:AuditLog[], total } }`
- `getLog`
  - req: `{ action:'getLog', id }`
  - res: `{ success, data:AuditLog }`

---

## 3. 数据模型（字段级）

### 3.1 users
```
{
  _id: string,
  openid: string,        // 唯一
  unionid?: string,
  profile?: { realName?: string, phone?: string, avatar?: string },
  status: 'active'|'suspended',
  lastLoginAt?: number,
  createdAt: number,
  updatedAt: number
}
```
索引：`openid` 唯一；`status` 普通。

### 3.2 roleBindings
```
{
  _id: string,
  userOpenId: string,
  role: 'admin'|'social_worker'|'volunteer'|'parent'|'guest',
  scopeType: 'global',
  state: 'active',
  expiresAt?: number,
  createdAt: number,
  createdBy?: string
}
```
索引：`userOpenId`；`role+state`。

### 3.3 roleRequests
```
{
  _id: string,
  applicantOpenId: string,
  type: 'role'|'contact_access',
  role?: 'volunteer'|'parent',
  scopeType?: 'patient',
  scopeId?: string,       // 当 type=contact_access 时绑定 patientId
  state: 'pending'|'approved'|'rejected',
  attachments?: { name:string, fileId:string }[],
  reason?: string,
  reviewerId?: string,
  reviewedAt?: number,
  createdAt: number,
  updatedAt: number
}
```
索引：`state+type`；`applicantOpenId`。

### 3.4 invites
```
{
  _id: string,
  code: string,
  role: 'volunteer'|'parent',
  orgId?: string,         // 单机构下可省略
  scopeType?: 'patient',
  scopeId?: string,       // 邀请家长绑定的 patientId（可选）
  usesLeft: number,
  expiresAt?: number,
  state: 'active'|'revoked'|'expired',
  createdBy: string,
  createdAt: number
}
```
索引：`code` 唯一；`state+role`。

### 3.5 auditLogs
```
{
  _id: string,
  actorUserId: string,
  actorRole?: string,
  action: string,         // e.g. 'role.approve', 'patient.update', 'export.detail'
  target?: { type:string, id?:string },
  message?: string,
  changes?: any,
  level?: 'info'|'warn'|'error',
  ip?: string,
  ua?: string,
  createdAt: number
}
```
索引：`createdAt` 倒序；`action`；`actorUserId`。

### 3.6 import_jobs（新增建议）
```
{
  _id: string,
  fileId: string,
  mode: 'smart'|'createOnly'|'updateOnly',
  state: 'queued'|'running'|'succeeded'|'failed',
  stats?: { total?:number, success?:number, failed?:number },
  errorFileId?: string,
  createdBy: string,
  createdAt: number,
  updatedAt: number
}
```
索引：`createdAt`；`state`。

### 3.7 export_jobs（新增建议）
```
{
  _id: string,
  filters: any,
  fieldsPolicy: 'full'|'masked',
  fileId?: string,
  state: 'queued'|'running'|'succeeded'|'failed',
  createdBy: string,
  createdAt: number,
  updatedAt: number
}
```
索引：`createdAt`；`state`。

---

## 4. 权限与页面级控制

- 管理端路由守卫：若 `roles` 不包含 `admin|social_worker` → 重定向 `/login` 或无权页。
- 操作级：
  - 授予/回收角色：仅 `admin`（可通过设置允许社工操作非管理员角色）。
  - 导入：默认仅 `admin`，可在 Settings 开关 `allowWorkerImport=true`。
  - 导出：`admin` 全字段；`social_worker` 强制 `fieldsPolicy='masked'`。
- 后端强制：所有写操作在云函数内复核角色，前端仅作 UX 优化。

---

## 5. 审计策略

- 记录范围：`role.add/remove`、`role.approve/reject`、`invite.create/revoke`、`import.*`、`export.*`、`patient.create/update/delete`、`media.delete`。
- 记录字段：操作者、角色、动作、目标（类型+ID）、时间、摘要、变更内容（可摘要）、IP/UA（可选）。
- 查询：按时间/动作/操作者/目标过滤；默认 30 天。

---

## 6. 错误码规范

- 通用：
  - `UNAUTHORIZED`（未登录/登录态无效）
  - `FORBIDDEN`（无权限）
  - `INVALID_INPUT`（参数错误）
  - `NOT_FOUND`（目标不存在）
  - `CONFLICT`（如重复绑定/导入冲突）
  - `RATE_LIMITED`、`INTERNAL_ERROR`
- 领域：
  - 角色：`ROLE_IMMUTABLE`（禁止操作 admin）、`ROLE_ALREADY_BOUND`
  - 邀请：`INVITE_EXPIRED`、`INVITE_REVOKED`
  - 导入：`INVALID_EXCEL_FILE_ID`、`IMPORT_FAILED`
  - 导出：`EXPORT_FAILED`

---

## 7. 时序与流程

### 7.1 登录流程
```
Web → auth.login → {ticket} → CloudBase.customAuth.signInWithTicket
   → rbac.getCurrentUser → { roles } → Router Guard → /dashboard
```

### 7.2 申请审批
```
List(pending) → Click detail → approve/reject(reason)
  → rbac.approveRoleRequest / rejectRoleRequest
  → (approve) rbac.addRoleBinding → auditLog(role.approve)
```

### 7.3 导入流程（任务化）
```
选文件/输入FileID → readExcel.parse(预览) → 确认参数(mode)
  → readExcel.import → { jobId }
  → 轮询 readExcel.getJob(jobId) 直至 succeeded/failed
  → 若失败提供 errorFile 下载；记录 auditLog(import.run)
```

### 7.4 导出流程（任务化）
```
选择过滤/策略 → patientProfile.export → { jobId }
  → 轮询 export_jobs → 生成文件 FileID → 取临时URL下载
  → 记录 auditLog(export.detail)
```

---

## 8. 性能与索引
- 分页：统一 page/pageSize，默认 20，最大 100。
- 列表排序：按 `createdAt desc`；支持关键字段排序（用户最近登录、申请时间等）。
- 索引建议：见 3.x 中集合描述；患者、申请、作业集合按 `state+createdAt` 组合索引优化列表。

---

## 9. 安全与会话
- 自定义登录 ticket 刷新：登录时记录 `ticketIssuedAt`；过期前刷新或重登。
- 存储：仅存储必要的用户信息与登录状态；不落地敏感凭证。
- 极端场景：后端强制权限，前端仅隐藏 UI。

---

## 10. 测试与验收

### 10.1 用例覆盖
- 登录守卫：无权限用户拒绝；admin/worker 进入成功。
- 用户列表：分页/筛选、禁用/启用（仅 admin）。
- 角色绑定：授予/回收、重复绑定、禁止操作 admin。
- 审批：通过/驳回路径、审计写入。
- 邀请：创建/作废、有效期与次数耗尽。
- 导入：解析预览、任务成功与失败（错误导出）。
- 导出：脱敏策略生效、水印检查、任务下载。
- 审计：过滤检索、详情展示。

### 10.2 验收标准
- 所有受限操作后端强制校验；无一处仅依赖前端隐藏。
- 错误码与提示统一、可追踪（审计至少覆盖变更类与导入/导出）。
- 列表响应 < 2s（100 条内），导入/导出任务可见进度与结果。

---

## 11. 发布与回滚
- 配置开关：`allowWorkerImport`、`workerExportMasked`（强制脱敏）。
- 灰度：先开放给少量管理员验证；再开放社工能力。
- 回滚：关闭开关或回退到只读视图。

---

## 12. 开放问题
- 社工是否被允许管理 `volunteer|parent` 的绑定？若允许需记录更严格审计。
- 导出脱敏策略的字段清单是否需要 UI 可配置？当前建议配置文件/环境开关。
- 导入冲突策略默认“智能合并”的规则细节（以证件号 > 姓名+生日 > 联系方式匹配）。

（完）
