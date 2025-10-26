# 设计交接包（Core Pages Rebuild）

## 交付概述

本交接包汇总 Story 001.2《核心页面设计重构》的所有设计产出，供前端与测试团队实施。内容涵盖四大页面规范、入住流程向导、响应式与无障碍策略，以及验证与跟踪计划。

## 文档清单

| 类型     | 文件                                           | 说明                               |
| -------- | ---------------------------------------------- | ---------------------------------- |
| 研究分析 | `docs/ux-research/user-journey-analysis.md`    | 用户旅程、痛点、指标与验证计划     |
| 页面设计 | `docs/page-designs/dashboard-redesign.md`      | 仪表盘模块化布局与交互细则         |
| 页面设计 | `docs/page-designs/patient-list-redesign.md`   | 患者列表的搜索、过滤、批量操作方案 |
| 页面设计 | `docs/page-designs/patient-detail-redesign.md` | 患者详情信息架构、编辑模式、时间轴 |
| 页面设计 | `docs/page-designs/intake-flow-redesign.md`    | 三步入住向导流程与智能校验         |
| 适配规范 | `docs/page-designs/responsive-design-guide.md` | 断点、布局、组件适配与性能策略     |
| 对接指南 | **本文件**                                     | 交付摘要与实施建议                 |

> 设计系统基础（Story 001.1 产出）：`docs/design-system/` 目录，可直接复用设计令牌、组件规范、验证清单。

## Figma 资源

- 文件结构建议：
  - `01_Base`：设计令牌与基础组件
  - `02_Core Pages`：仪表盘、列表、详情、入住流程高保真
  - `03_Responsive`：断点样式与交互动效
  - `04_Prototypes`：关键任务交互原型（含备注）
- 命名规范：`Page/Variant/State`，如 `PatientList/Card/Active`。
- 版本策略：采用 Figma Branch 提交，合并后更新版本号与备忘录。

## 前端实现建议

1. **组件化拆分**
   - 共用基础组件：KPI 卡片、快速操作面板、智能搜索框、步骤向导、时间轴。
   - 页面容器：仪表盘容器、列表容器、详情信息分组、入住向导步骤页。
2. **样式与布局**
   - 令牌来源：维护 `design-tokens.json`，执行 `npm run tokens:generate` 生成 `wx-project/styles/generated/tokens.{wxss,js}`，再由页面/组件通过 `@import "../../styles/generated/tokens.wxss"` 与 `foundation.wxss`、`utilities.wxss` 引入。
   - 响应式与工具类统一复用 `wx-project/styles/responsive.wxss`、`foundation.wxss`、`utilities.wxss`，必要时在 `wx-project/styles/components/` 下新增局部样式。
3. **状态管理**
   - 仪表盘与列表建议使用状态缓存，减少重复请求。
   - 入住流程使用分段提交，必要时落地本地草稿。
4. **数据接口**
   - 优先与后端确认筛选、批量操作、风险评估、附件上传的接口格式。
   - 关注权限控制与操作日志字段。

## 验证与度量

- 参考 `docs/design-system/validation-checklist.md` 执行设计完成度检查。
- 关键指标：
  - 搜索成功率 ≥ 95%，入住完成率提升 50%。
  - 仪表盘首屏加载 < 2s，交互响应 < 100ms。
  - 可用性测试满意度 ≥ 4.5/5。
- 推荐在上线后 2 周与 1 个月分别复盘数据指标与用户反馈。

## 沟通与支持

- **沟通渠道**：项目微信群、Figma 评论、飞书任务。
- **设计响应 SLA**：工作日 09:30-18:30，关键问题 2 小时内响应。
- **交付同步**：开发每日站会同步设计落地进度；测试前召开介面走查会议。
- **持续改进**：每两周收集一次用户反馈与数据报告，进入设计改进看板。

## 文档信息

- **版本**：1.1
- **更新时间**：2025-09-22
- **负责人**：产品设计团队
