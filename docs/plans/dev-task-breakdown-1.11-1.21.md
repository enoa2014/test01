# Dev 任务拆分（Stories 1.11–1.21）

更新时间：2025-10-07
编写人：James（Dev）

> 说明：以下条目可直接导入看板，按故事编号创建任务；测试项引用 `docs/qa/assessments/*-test-design-20251007.md`，方便开发在提交前自检。

## 1.11 patient-detail-section-navigation
- [ ] 页面结构与样式：新增锚点导航容器、吸顶样式、返回顶部按钮（参考 `1.11-INT-001/004`）。
- [ ] 交互逻辑：实现 anchor 点击、滚动联动、加载禁用（参考 `1.11-INT-002/003`）。
- [ ] 无障碍与回归：键盘导航、数据展示回归（`1.11-E2E-001 ~ 003`）。

## 1.12 patient-media-advanced-controls
- [ ] 排序/筛选逻辑实现：扩展 `mediaService` 与前端状态机（`1.12-UNIT-001/002`，`1.12-INT-001/002`）。
- [ ] 批量操作与权限校验：批量选择 UI、删除确认、刷新配额（`1.12-INT-003`，`1.12-E2E-002`）。
- [ ] 空态 & 可访问性：补齐文案、pm-button 样式、aria 属性（`1.12-INT-004/005`）。

## 1.13 patient-theme-token-alignment
- [ ] Token 清理：更新 `tailwind.input.css` 与相关组件令牌引用（`1.13-UNIT-001/002`）。
- [ ] ThemeIndicator 组件：复用 ThemePicker 逻辑、pm-button（`1.13-INT-002`）。
- [ ] 构建验证：运行 `npm run tokens:generate` + 快照检查（`1.13-UNIT-003`）。

## 1.14 tenant-list-batch-toolbar
- [ ] 卡片信息层级调整：更新 `patient-card` 样式与点击区域（`1.14-INT-001`）。
- [ ] 吸顶批量工具栏：实现选择逻辑、pm-button 状态（`1.14-UNIT-002`，`1.14-INT-002`）。
- [ ] 悬浮按钮 & 回到顶部：滚动监听、筛选入口联动（`1.14-INT-003`，`1.14-E2E-003`）。

## 1.15 patient-detail-status-semantic
- [ ] 状态映射表：集中颜色/图标常量（`1.15-UNIT-001`）。
- [ ] 操作按钮强化：pm-button 变体、危险操作确认（`1.15-INT-002`，`1.15-E2E-001`）。
- [ ] 可访问性验证：对比度脚本、aria-label（`1.15-INT-003`）。

## 1.16 patient-intake-wizard-guidance
- [ ] 搜索高亮与空态 CTA：更新选择页渲染（`1.16-INT-001`）。
- [ ] 即时校验与错误计数：字段配置、顶部错误条（`1.16-INT-002/003`）。
- [ ] 完成页 CTA 与刷新：入口按钮顺序、列表刷新机制（`1.16-INT-004/005`）。

## 1.17 analysis-sticky-filters
- [ ] 吸顶筛选条：封装 filter-panel + sticky 容器（`1.17-INT-001`）。
- [ ] 筛选摘要 & 清除：pm-badge ghost 标签、清空逻辑（`1.17-INT-002`）。
- [ ] 状态持久化：本地存储键 `analysis:filters:v1`、恢复逻辑（`1.17-INT-004`）。

## 1.18 patient-ui-feedback-accessibility
- [ ] feedback.js 封装：toast/loading/dialog 统一接口（`1.18-UNIT-001/002`）。
- [ ] 命中区与 aria：更新按钮/图标尺寸及标签（`1.18-INT-002/003`）。
- [ ] 页面接入：详情、列表、录入迁移到新接口（`1.18-INT-004/005`）。

## 1.19 patient-performance-optimizations
- [ ] 列表分页 & Skeleton：实现分页请求、骨架高度适配（`1.19-INT-001/002`）。
- [ ] 详情分段 setData：基础信息、记录、附件分批渲染（`1.19-INT-003/004`）。
- [ ] 附件懒加载与重试：缓存/重试策略（`1.19-INT-005`）。
- [ ] 性能指标脚本：弱网 TTI 测试、记录结果（`1.19-E2E-004`）。

## 1.20 patient-copywriting-consistency
- [ ] 文案常量表：输出状态文案并集中引用（`1.20-UNIT-003/004`）。
- [ ] 页面替换：详情/列表/附件/录入文本更新（`1.20-INT-002/003`）。
- [ ] 测试断言同步：更新快照或测试常量引用（`1.20-E2E-002`）。

## 1.21 design-system-component-hardening
- [ ] 新组件落地：pm-section-header、pm-stat-card、pm-empty-state 等（`1.21-INT-001`）。
- [ ] 页面替换：详情/列表/分析应用新组件（`1.21-INT-002/003`）。
- [ ] 快照/视觉校验：Jest snapshot + Mpflow diff（`1.21-UNIT-003`，`1.21-INT-004`）。

---

> 看板建议：每个故事建立 “开发” 主任务，并按照上述子项创建 Checklist；同时在任务链接中附上对应测试设计文档路径。
