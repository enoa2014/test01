# 患者数据云函数重构方案

## 背景

patientProfile 云函数目前同时依赖 patients 集合与 Excel 导入的 excel_records。列表接口与详情接口访问的数据源不同，导致字段缺失、缓存失效和性能问题。为了支撑后续的入住流程优化，需要梳理统一的数据主线，并降低云函数的维护成本。

## 现状梳理

- **列表接口**：patientProfile.list 读取 patients 集合的摘要字段，但仍包含旧的 Excel 聚合逻辑。为防止冷启动超时，会在 excel_cache 集合写入首屏缓存。
- **详情接口**：patientProfile.detail 直接查询 Excel 记录，再补上一部分 patient_intake_records 数据，与列表逻辑脱节。
- **同步方式**：通过脚本 (ix-patient-admissions.js、	est-intake-records.js) 与 patientIntake/excel-sync 模块手动刷新 patients 摘要，没有自动化触发机制。
- **工具函数**：
ormalizeTimestamp、safeNumber 等分散在多处，存在重复与缺失（曾出现未定义导致 SyntaxError 的问题）。

## 核心问题

1. **数据源不一致**：Excel 是导入的初始数据，但在线系统已经具备 patients 与 patient_intake_records。详情依赖 Excel 导致新增患者或同步失败时页面报错。
2. **缓存不可控**：excel_cache/patients_summary_cache 需要人工删除才能刷新，无法感知数据更新。
3. **耦合与重复**：脚本、云函数、前端分别维护相似的汇总逻辑，修改难度大。
4. **执行性能**：分页查询和多次 ensureCollectionExists 串行执行，在数据量增加时频繁超过 3 秒限制。

## 重构目标

- 确立 patients + patient_intake_records 为唯一可信数据源。
- 将同步与统计逻辑集中到后端服务/触发器，避免前端或人工脚本介入。
- 提升云函数响应性能，使首屏请求稳定在 3 秒以内。
- 统一工具函数、错误码与日志，便于监控与排障。

## 目标架构

`
Excel 导入 -> patientIntake/excel-sync -> patients + patient_intake_records
                                |                          |
                                |----> Stats Aggregator ---|
                                            |
                                            V
                             patientProfile Service (list/detail)
                                            |
                                            V
                                   excel_cache (首屏缓存)
`

- **Stats Aggregator**：在 patient_intake_records 新增/更新后触发，负责计算入住次数、最新入院时间、摘要信息，并写回 patients 与缓存。
- **Service 层**：提供 getPatientList、getPatientDetail 方法，云函数入口仅负责校验与返回格式。
- **Util 库**：集中管理 
ormalizeValue、
ormalizeTimestamp、safeNumber、ormatDate 等函数，并覆盖单元测试。

## 接口设计

### patientProfile.list

- **入参**：page、pageSize、orceRefresh、includeTotal。
- **流程**：
  1. 检查缓存 (patients_summary_cache) 是否在 TTL 内，命中直接返回。
  2. 否则通过 patientsRepo.fetchSummaries({ skip, limit }) 读取分页数据。
  3. 若 page === 0，异步刷新缓存，并返回 hasMore、
extPage、	otalCount。
- **返回字段**：patientKey、patientName、dmissionCount、latestAdmissionDate、summaryCaregivers 等。

### patientProfile.detail

- **入参**：patientKey / profileKey。
- **流程**：
  1. 通过 patientsRepo.getById 获取患者基本信息。
  2. 并行查询 intakeRepo.listAll(patientKey) 与 operationLogsRepo.listRecent。
  3. 若缺少历史记录，调用 excel-sync 进行一次性补齐，并回写 patients。
  4. 按信息块（基本信息、家庭信息、入住记录、操作日志）整理返回。

## 数据同步策略

- **触发器**：在 patient_intake_records create/update 后触发 aggregator 云函数，按 patientKey 重算 dmissionCount、irstAdmissionDate、latestAdmissionTimestamp。
- **批量脚本**：保留 ix-patient-admissions.js 作为运维手段，但优先由触发器覆盖日常需求。
- **缓存刷新**：Aggregator 将首屏摘要写入缓存，并记录 ersion 与 limit；patientProfile.list 读取时校验版本号，发现有升级则强制重新加载。

## 错误与日志规范

- 定义错误码：PATIENT_NOT_FOUND、DETAIL_SYNC_REQUIRED、CACHE_MISS、STORAGE_TIMEOUT 等。
- 日志格式：[module] action failed - requestId - message - payload，统一使用英文，必要时在 details 中携带参数。
- 对云函数超时 (>2500ms) 的情况记录警告日志并计数。

## 实施计划

1. **整理工具库与仓储层**
   - 新建 cloudfunctions/patientProfile/repos/、utils/ 目录；迁移 normalize/safeNumber 等函数，编写单测。
2. **重构 patientProfile**
   - 分离 list、detail 业务逻辑到 service 层；删除 Excel 直接读取逻辑。
3. **实现统计触发器**
   - 在 patient_intake_records 上配置触发器或创建异步任务，更新 patients 摘要并刷新缓存。
4. **完善缓存策略**
   - 更新 excel_cache 文档结构，并在 list 中增加版本校验。
5. **统一错误码**
   - 在 makeError 中增设错误枚举；更新前端对错误码的提示文案。
6. **迁移脚本**
   - 将 ix-patient-admissions 封装为 CLI 命令，支持分页与重试。
7. **回归测试**
   - 编写端到端测试校验列表与详情的一致性；在测试环境跑通缓存命中/失效逻辑。
8. **上线与监控**
   - 部署触发器与云函数，收集日志，确保 3 秒超时警告消失。

## 风险与应对

- **历史数据缺失**：执行重构前先对 patients 与 patient_intake_records 做全量校验，必要时通过脚本补齐。
- **缓存同步延迟**：在 list 中加入 orceRefresh 参数，并设定合理 TTL（建议 5 分钟），同时在后台定期刷新。
- **触发器负载**：可设置队列或限流，避免高并发写操作阻塞；必要时将统计任务拆分为批量处理。

## 预期收益

- 列表详情数据一致性提升，杜绝 Excel 数据缺失导致的报错。
- 云函数响应时间稳定在阈值以内，减少 -504002、-504003 超时。
- 工具函数与错误处理统一，后续维护成本下降。
- 自动化同步机制减少人工脚本干预，提升运营效率。
