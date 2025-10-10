# Web 管理端住户 CRUD 方案（对齐小程序交互）

本文档细化“参考小程序，在 Web 端实现住户查找、修改资料、新增、删除”的设计与实施计划，覆盖后端接口扩展、前端页面与交互、权限、安全、测试与发布步骤。本文仅为计划，不包含实现代码。

## 背景与目标
- 背景：小程序端已具备住户列表、智能搜索、录入与部分编辑能力；Web 端目前仅有列表与详情查看、删除与导出能力（云函数 `patientProfile` 支持 list/detail/delete/export）。
- 目标：在 Web 端补齐住户“查找、修改资料、新增、删除（含批量）”能力，权限收口至管理员；交互与字段尽可能对齐小程序。

## 功能范围
- 查找/筛选：
  - 关键词匹配：姓名、证件号、电话（包含式匹配与大小写不敏感）。
  - 筛选项：籍贯（nativePlace）、性别（gender）、在住状态（careStatus: in_care/discharged）。
  - 分页：page/limit，支持与缓存联动（首屏缓存加速）。
- 新增：
  - 最小必填：姓名、性别、（证件号 或 电话 至少一项）、籍贯/地址二选一。
  - 去重校验：优先证件号唯一；备选（姓名 + 任一电话）命中视为重复。
- 修改：
  - 支持在详情页进入编辑、或独立表单页编辑基础信息与联系人字段。
  - 更新 `updatedAt` 并记录操作日志。
- 删除：
  - 单条与批量删除；二次确认与不可恢复提示；删除后失效列表缓存。
- 权限：
  - 仅管理员（`admins` 集合、状态有效）可新增/修改/删除；匿名或非管理员仅可浏览。

## 架构总览
- 后端：扩展 `cloudfunctions/patientProfile/index.js` 新增 `create`、`update`、列表过滤；在函数内进行权限校验、输入校验、去重与缓存失效；新增操作日志记录。
- 前端（web-admin）：
  - API 封装 CRUD；
  - 新增 `PatientFormPage`（新增/编辑）；
  - 列表页集成搜索/筛选/批量删除；
  - 受保护路由与按钮级权限控制；
  - 统一错误提示与加载态。

## 数据与索引
- 主要集合：
  - `patients`（住户档案，已存在），`excel_records`、`patient_intake_records`、`patient_media` 等沿用。
  - 日志：`patient_operation_logs`（已存在 delete 日志，扩展 create/update）。
- 推荐索引（在腾讯云控制台创建）：
  - 单字段：`patientName`、`idNumber`、`phone`、`nativePlace`、`careStatus`、`updatedAt`。
  - 复合：`["data.updatedAt", "patientName"]`（列表排序/检索），`["idNumber", "patientName"]`（去重/查询）。

## 后端接口设计（cloudfunctions/patientProfile）

### 权限与上下文
- 统一辅助：`requireAdmin(authCtx)` → 读取 CloudBase 自定义登录态，查询 `admins` 集合，校验 `status!="disabled"`。
- 无权限返回：`{ success:false, error:{ code:"FORBIDDEN", message:"无权限" } }`。

### list（增强）
- 入参：
  ```json
  {
    "action": "list",
    "page": 0,
    "pageSize": 40,
    "keyword": "张三/证件号/电话",
    "filters": { "gender": "男", "careStatus": "in_care", "nativePlace": "河南" },
    "includeTotal": true,
    "forceRefresh": false
  }
  ```
- 行为：
  - keyword 使用 `db.RegExp({ options: 'i' })` 模糊匹配 `patientName/idNumber/phone`。
  - filters 按等值过滤；分页；首屏命中缓存则直接返回缓存片段。
- 出参：
  ```json
  { "patients": [...], "totalCount": 123, "hasMore": true }
  ```

### detail（沿用）
- 入参：`{ "action": "detail", "patientKey": "..." }`
- 出参：沿用现有结构。

### create（新增）
- 入参：
  ```json
  {
    "action": "create",
    "data": {
      "patientName": "张三",
      "gender": "男",
      "birthDate": "2012-05-01",
      "nativePlace": "河南省周口市",
      "ethnicity": "汉族",
      "idNumber": "4101...",
      "phone": "138****8888",
      "address": "",
      "fatherContactName": "张某",
      "fatherContactPhone": "",
      "motherContactName": "李某",
      "motherContactPhone": "",
      "guardianContactName": "",
      "guardianContactPhone": "",
      "backupContact": "",
      "backupPhone": ""
    }
  }
  ```
- 校验：必填/格式；去重（证件号唯一或 姓名+电话 命中）。
- 行为：
  - 生成稳定 `patientKey`（复用现有 `utils/patient` 生成策略或采用 `_id`）。
  - 写入顶层主要字段，并设置 `createdAt/updatedAt`；必要时同步部分字段到 `data.*` 以兼容读取。
  - 记录操作日志：`type: 'create'`。
  - 失效缓存。
- 出参：`{ "success": true, "patientKey": "..." }` 或 `DUPLICATE_PATIENT/INVALID_INPUT/FORBIDDEN`。

### update（新增）
- 入参：
  ```json
  {
    "action": "update",
    "patientKey": "...", // 或 _id
    "patch": { "phone": "139****9999", "address": "...", "careStatus": "discharged" },
    "options": { "merge": true }
  }
  ```
- 行为：
  - 权限校验；目标存在性校验；可选去重（当 `idNumber` 或（姓名+电话）变更时）。
  - 执行局部更新：顶层字段为主，同步 `updatedAt`；必要时同步 `data.*`。
  - 记录操作日志：`type: 'update'`，`metadata.changeSet` 存变更摘要。
  - 失效缓存。
- 出参：`{ "success": true }` 或错误码。

### delete（沿用，补充权限）
- 入参：`{ "action": "delete", "patientKey": "...", "operator": "admin:xxx" }`
- 行为：沿用现有删除逻辑，操作前校验管理员。

### 错误码规范
- `FORBIDDEN` 无权限
- `INVALID_INPUT` 入参缺失/格式不符
- `DUPLICATE_PATIENT` 违反去重策略
- `PATIENT_NOT_FOUND` 目标不存在
- 其它内部错误：`INTERNAL_ERROR`

## 前端设计（web-admin）

### 路由结构
- `/patients` 列表（已存在，增强搜索/筛选/批量删除）
- `/patients/new` 新建
- `/patients/:patientKey` 详情（已存在）
- `/patients/:patientKey/edit` 编辑

### 页面与组件
- PatientListPage（增强）：
  - 顶部：搜索输入（300ms 防抖）+ 筛选（nativePlace/gender/careStatus）。
  - 表格：字段（姓名、性别、证件号、电话、籍贯/地址、在住状态、最近入院时间）。
  - 操作：`新增住户`、行内 `编辑/删除`、多选 `批量删除`。
- PatientDetailPage（微调）：
  - 增加 `编辑` 按钮；无管理员权限不展示。
- PatientFormPage（新增）：
  - 创建/编辑复用同一表单组件；
  - 字段对齐小程序 `miniprogram/config/patient-detail-fields.js` 的核心子集；
  - 表单校验与错误提示；
  - 成功后返回列表或详情并提示。

### API 封装
- `src/api/patient.ts`
  - 新增：`createPatient(app, data)`、`updatePatient(app, key, patch)`；
  - `fetchPatientList` 支持 `{ keyword, filters, page, pageSize }`；
  - 删除沿用 `deletePatient`；导出沿用 `exportPatients`。

### 权限与拦截
- 路由守卫：`/patients/new`、`/patients/:key/edit` 仅 `user.role==='admin'` 进入；否则重定向 `/patients` 并提示。
- 按钮级控制：非管理员隐藏“新增”“编辑”“删除”相关按钮。
- 服务端强校验：即使前端放行失败也会被后端拦截。

### 交互与体验
- 加载态与禁用态；
- 删除二次确认（输入住户姓名或勾选确认）；
- 批量删除展示影响条数；
- 表单离开未保存提示；
- 统一错误文案：权限、校验、网络、未知错误分类提示。

## 流程说明
- 新增：列表页点击“新增住户”→ 表单校验 → 调 `create` → 成功提示并跳转详情/列表 → 刷新数据。
- 编辑：详情页点“编辑”→ 表单修改 → 调 `update` → 成功回到详情，展示最新信息。
- 删除：列表（行内/批量）→ 二次确认 → 调 `delete` → 刷新列表；失败展示错误原因。
- 搜索：输入关键字防抖 → 拉取服务端过滤结果（首屏可用缓存）。

## 测试计划
- 服务测试（`tests/service`）：
  - create：成功、缺字段、重复、无权限。
  - update：成功、目标不存在、重复、无权限、部分字段更新。
  - list：keyword/filters 组合、分页、缓存命中/失效。
  - delete：成功、无权限。
- Web 端（轻量单测/集成）：
  - 搜索防抖逻辑、表单校验函数、API 参数拼装。
- 端到端（可选）：
  - 登录→新增→搜索→编辑→删除闭环；使用 Playwright 或手动验证步骤在文档记录。

## 部署与配置
- 云函数：
  - 部署 `patientProfile`（新增 create/update 逻辑）；
  - 环境变量：保持自定义登录配置；
  - 创建/校验集合索引（上文“数据与索引”）。
- Web 管理端：
  - `.env.local`：`VITE_TCB_ENV_ID`、`VITE_AUTH_FUNCTION_NAME=auth`；
  - 构建：`npm run build`，预览 `npm run preview` 或 `npm run serve`。

## 里程碑与交付
- M1（后端能力）：create/update/过滤与权限、服务测试通过、缓存失效链路稳定。
- M2（前端基础）：列表搜索/筛选、新增/编辑页、表单校验、错误提示。
- M3（体验增强）：批量删除、离开提示、操作日志校验、权限文案打磨。
- M4（验收与文档）：操作手册（截图）、已知限制、回归测试记录。

## 风险与对策
- 旧数据字段分布不一致（顶层与 `data.*`）：
  - 对策：写入以顶层为准，同时最小同步关键字段到 `data.*` 确保兼容读取。
- 去重误判：
  - 对策：后端仅阻止高置信度冲突（证件号唯一）；姓名+电话仅警告或要求用户确认；必要时引入 `uniqueKey` 映射。
- 匿名态放行风险：
  - 对策：前端仅隐藏操作按钮不足以防护，服务端必须强校验管理员；路由级与页面级双重收口。

## 环境依赖补充
- 本地运行 `tests/service` 需要 `ci-info` 模块（Jest 间接依赖），当前 `npm install` 在部分环境会因目录占用报 `ENOTEMPTY`，后续需补充依赖或调整测试脚本以规避。
- Web 管理端依赖 `@cloudbase/js-sdk`，其类型定义与现有 `tsconfig` 存在兼容性告警，执行 `npm run build` 会出现类型错误；后续建议锁定 SDK 版本或通过类型补丁统一定义。

## 验收标准（示例）
- 管理员：完成新增→搜索→编辑→删除完整闭环，无错误与数据残留；
- 非管理员：无法访问新增/编辑路由，无删除按钮；
- 列表搜索/筛选：精确命中、分页稳定、首屏缓存命中；
- 操作日志：create/update/delete 均有记录，字段正确。

## 任务分解与清单
- 后端
  - [ ] `list` 增加 keyword/filters
  - [ ] `create` 实现 + 去重 + 日志 + 失效缓存
  - [ ] `update` 实现 + 校验 + 日志 + 失效缓存
  - [ ] 权限校验辅助 `requireAdmin`
  - [ ] 服务测试用例
- 前端
  - [ ] API 扩展 create/update 与列表过滤参数
  - [ ] 新增 `PatientFormPage`（新增/编辑复用）
  - [ ] 列表页增强：搜索/筛选/批量删除/权限控制
  - [ ] 详情页添加“编辑”入口
  - [ ] 路由守卫与错误提示统一
  - [ ] 关键交互单测/集成测试
- 文档与交付
  - [ ] 操作手册与截图
  - [ ] 部署与回滚步骤
  - [ ] 索引与环境检查脚本（可选）

---
如需我据此开始实施，请确认是否需要：
- 去重策略采用“证件号唯一 + 姓名+电话二次确认”还是“严格阻止重复”；
- 编辑表单字段是否需要完全对齐小程序配置，或仅保留核心字段；
- 是否需要在 Web 端添加媒体管理（与小程序 `MediaManager` 对齐）。
