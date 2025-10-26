# 文档目录（导航）

以下为首批迁移后的导航清单，后续将持续补全与去重。

## 小程序（Miniprogram）
- 站点地图：miniprogram/site-map.md
- 组件索引：miniprogram/components/index.md
- 页面说明：
  - 列表页：miniprogram/pages/index.md
  - 患者详情：miniprogram/pages/patient-detail.md
  - 入住向导：miniprogram/pages/patient-intake.md

## 业务组件（Business Components）
- 患者卡片
  - 用例：business-components/patient-card/use-cases.md
  - 性能：business-components/patient-card/performance.md
  - 批量选择：business-components/patient-card/batch-selection.md
- 智能搜索栏
  - 结构：business-components/smart-search-bar/structure.md

## 体验分析与优化（UX Analysis）
- 首页
  - 分析（当前版）：ux-analysis/index-page/analysis-v2.md
- 患者接收入院流程
  - 优化方案：ux-analysis/patient-intake/optimization-plan.md
  - 新建住户档案优化方案：ux-analysis/patient-intake/new-resident-profile-ui-ux-optimization.md
- 患者列表
  - UI润色：ux-analysis/patient-list/ui-polish.md
  - 可视化检查清单：ux-analysis/patient-list/visual-checklist.md
  - 视觉对比：ux-analysis/patient-list/visual-diff.md
- 其他
  - 住户分析页面 UI 设计分析报告：ux-analysis/resident/resident-analysis-ui-design-report.md
  - 住户卡片 UI 设计分析报告：ux-analysis/resident/resident-card-ui-design-report.md

## 测试（Testing）
- 手工测试指南：testing/manual-test-guide.md
- 清单
  - 阶段2：testing/checklists/stage2.md
- 测试数据
  - 入院记录：testing/data/testing-intake-records.md

## 计划与报告（Plans & Reports）
- 报告
  - UI 实施复盘：plans/reports/ui-implementation-review.md
  - 阶段三实施报告：plans/reports/stage3-implementation-report.md
- 改进计划
  - 批处理模式改进：plans/batch-mode-improvement.md
  - 入职与权限开通 · 阶段1：plans/onboarding/phase-1-unified-entry.md
  - 入职与权限开通 · 阶段2：plans/onboarding/phase-2-templates.md

## 运维与操作（Operations）
- 后台紧急联系人移除操作：operations/backend-emergency-contact-removal.md

## 指南与操作手册（Guides）
- 新成员注册与权限开通（社工/志愿者/家长）：guides/new-member-onboarding.md
- 二维码邀请与注册：guides/qr-invite.md

## 设计与重构（Design）
- UI 重构（患者列表页）
  - 总览：design/ui-refactor/overview.md
  - 页面方案与实现：design/ui-refactor/pages.md
  - 组件与设计系统对齐：design/ui-refactor/components.md
  - 变更记录与度量：design/ui-refactor/changelog.md

## UI/UX（Design Docs）
- 信息架构：uiux/information-architecture-doc.md
- 交互设计：uiux/interaction-design-doc.md
- 视觉设计：uiux/visual-design-doc.md
- 组件库：uiux/component-library-doc.md
- 用户研究：uiux/user-research-doc.md
- 行动计划：uiux/project-action-plan.md

## 架构与数据（Architecture）
- 技术栈与目录：architecture/tech-stack.md、architecture/source-tree.md
- 数据模型（Schema 草案）：database-schema.md
- 云函数架构：cloud-function-architecture.md
- API 参考（草案）：api-reference.md
- 配置与环境变量：configuration.md
- 媒体访问控制：security/media-access-control.md

## 云函数（Cloudfunctions）
- 总览：cloud-function-architecture.md
- 入住流程（表单校验）：cloudfunctions/patient-intake/form-validation.md
- 媒体与附件约束：cloudfunctions/patient-media/constraints.md
- 患者档案查询：cloudfunctions/patient-profile/README.md
- 聚合服务：cloudfunctions/patient-service/README.md
- Excel 导入与同步：cloudfunctions/read-excel/README.md

## 认证与授权（Authentication）
- 扫码登录系统需求文档：qr-login-requirements.md
- 扫码登录系统技术设计文档：qr-login-technical-design.md
- 扫码登录系统API接口文档：qr-login-api-documentation.md

<!-- 历史归档已清理；如需过往版本请查阅 Git 历史 -->
