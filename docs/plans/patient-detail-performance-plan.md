# 住户详情页加载优化实施方案

## 目标
- 首屏可感知加载时间 < 1.5s
- 完整页面加载 < 3.5s
- 云函数调用次数从 4 次降至 ≤2 次

## 阶段一：接口整合与首屏降载

### 任务
1. 后端新增 patientDetail.full 云函数（或扩展已有 patientProfile.detail）。
2. 云函数内部并行获取档案概览、最近 intake 摘要、操作日志。
3. 前端 patient-detail 页改为只调用新接口并分段 setData。

### 步骤
1. 后端
   - [ ] 创建新函数或重构 patientProfile/index.js
   - [ ] 使用 Promise.all 并发调用现有读操作
   - [ ] 输出结构：overview, asicInfo, amily, economic, latestIntake, ecordPreview, operationLogs
   - [ ] 增加日志记录三大子查询耗时
   - [ ] 单元测试：mock 数据验证返回结构
2. 前端
   - [ ] 更新 etchPatientDetail 调用
   - [ ] 首屏先渲染 overview + asicInfo
   - [ ] 通过 
extTick 或 setData 分批注入剩余数据
   - [ ] 加入性能上报
3. 测试
   - [ ] 功能回归
   - [ ] 比较接口耗时

## 阶段二：Excel 同步后台化

### 任务
1. 移除 getPatientDetail/getAllIntakeRecords 中的 syncExcelRecordsToIntake 调用。
2. 建立触发器/定时任务同步 Excel → intake。
3. 为详情接口增加 syncStatus 字段（提示数据是否最新）。

### 步骤
1. 后端
   - [ ] 在 patientIntake/index.js 中跳过同步流程
   - [ ] 新建定时任务函数 excelSyncWorker
   - [ ] 同步逻辑：分页拉 Excel 记录 → 更新 intake → 更新患者摘要
   - [ ] 同步状态写入 patient_sync_status 集合
2. 前端
   - [ ] 接受 syncStatus 并在 UI 标示（如“上次同步时间”）
3. 测试
   - [ ] 定时任务沙箱验证
   - [ ] 多数据量性能测试

## 阶段三：分页与懒加载

### 任务
1. getAllIntakeRecords 支持 limit、offset。
2. 前端默认取 20 条，滚动加载更多。
3. 附件 Tab 首次打开时再调用 patientMedia/list。

### 步骤
1. 后端
   - [ ] 更新 patientIntake/index.js 分页逻辑
   - [ ] 返回 	otalCount + hasMore
2. 前端
   - [ ] 新增分页状态管理
   - [ ] 媒体模块改为懒加载（监听 Tab 切换）
   - [ ] 加入 loading skeleton
3. 测试
   - [ ] 数据量 1/20/100 条下滚动体验
   - [ ] 附件加载在首屏未触发

## 阶段四：缓存与监控

### 任务
1. 引入缓存层（云函数内存缓存 / TCB 缓存）缓存热点患者详情。
2. 建立 wx.reportPerformance + 云函数日志聚合。
3. 建立 SLA 告警（接口 >1s、错误率 >1%）。

## 里程碑
| 阶段 | 负责人 | 预计时长 | 验收标准 |
| ---- | ------ | -------- | -------- |
| 一 | 后端 A / 前端 B | 1 周 | 首屏接口 1 次，平均耗时 < 400ms |
| 二 | 后端 A | 1 周 | 同步任务独立运行，详情接口无写操作 |
| 三 | 前端 B / 后端 C | 1 周 | 首屏数据量减半，媒体懒加载成功 |
| 四 | 全栈团队 | 0.5 周 | 仪表盘上线，SLA 告警配置完成 |

## 风险与应对
- 同步任务积压：加入队列监控 + 手工触发入口
- 缓存失效导致数据旧：缓存配置短 TTL + 主动刷新
- 分页导致遗漏：设计“全部导出”按钮调用旧接口

## 验收指标
- wx.reportPerformance: 首屏 TTI < 1500ms
- 云函数日志：patientDetail.full 95th < 600ms
- 用户反馈：问卷满意度 ≥ 90%
