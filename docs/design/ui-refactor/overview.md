# 患者列表页 UI 重构总览

> 目的：汇总重构背景、评估结论与导航，详细技术与页面实现拆分见同目录文档。
>
> - 分析对象：`wx-project/pages/index/`
> - 当前基线：2025-10-01（重构前实现）
> - 重构目标：提升信息密度、视觉层次与操作效率

---

## 评估总结（与设计系统对齐）

| 维度         | 原方案 | 设计系统规范 | 状态 |
| ------------ | ------ | ------------ | ---- |
| 设计令牌     | 部分使用，存在硬编码 | `design-tokens` 全量应用 | 需调整 |
| 圆角/阴影    | 值不统一 | `radius-*` / `shadow-*` 令牌 | 需规范 |
| 颜色系统     | 自定义渐变 | 品牌主色/语义色 | 需修正 |
| 组件复用     | 复造组件 | 复用 `pm-*` | 待落地 |
| 业务组件     | 未规划 | `PatientCard`、`SmartSearchBar` | 待集成 |

要点：全面采用设计令牌与既有组件库，统一圆角/阴影/间距与品牌色；页面以 `PatientCard`（compact 模式）为主。

---

## 改进概览

- 工具栏单行化，新增图标按钮（排序、批量）
- 患者卡片信息增强（最近事件、标签、徽章）
- 操作按钮收敛为“更多”，弹出 ActionSheet
- 骨架屏动效与空状态视觉增强
- 批量模式入口显式化（长按 + 图标按钮）

指标对比（节选）：
- 工具栏高度：~180rpx → ~100rpx（-44%）
- 可见卡片：3.5 → 5（+43%）
- 操作按钮：3/卡片 → 1/卡片（-67%）

---

## 文档导航

- 页面方案与实现：`docs/design/ui-refactor/pages.md`
- 组件与设计系统对齐：`docs/design/ui-refactor/components.md`
- 变更记录与度量：`docs/design/ui-refactor/changelog.md`

相关参考：
- 设计系统与令牌：`docs/design-system/design-tokens-spec.md`
- 页面方案：`docs/page-designs/patient-list-redesign.md`
- 业务组件：`docs/business-components/patient-card.md`、`docs/business-components/smart-search-bar.md`

---

## 时间线与范围

- 重构评审：2025-10-01 ～ 2025-10-02
- 开发阶段：阶段 1（基础优化）→ 阶段 2（交互增强）→ 阶段 4（性能）→ 阶段 3（高级特性）
- 影响范围：患者列表页，`PatientCard`/`SmartSearchBar` 等业务组件

---

## 说明

本目录已拆分大型历史报告，原始长文档不再保留；如需历史版本，请查阅 Git 提交历史。
