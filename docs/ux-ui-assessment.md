# 前端 UX/UI 评估与优化建议（V1）

- 范围与目标
  - 范围：小程序端住户列表、详情、录入向导、分析页及通用组件/样式。
  - 目标：提升一致性、可用性与首屏性能，降低复杂场景的认知负担与误触几率。

---

## 总体评估

- 积极面
  - 已引入设计令牌与 Tailwind，主题可全局跟随。
  - 卡片体系与信息架构基本清晰。

- 主要问题
  - 主题体系与语义变量混用，跨页风格不完全一致。
  - 详情页首屏网络并发与渐进呈现不足，附件区加载成本高。
  - 信息密度高但层级区分不够，缺少分段导航与筛选。
  - 文案、加载/禁用/错误状态展示不统一。
  - 操作按钮可视权重偏低，误触与不可达风险存在。

---

## 设计系统与一致性

- 统一主题命名与变量
  - 规范仅使用语义类：`text-primary`/`text-secondary`、`bg-surface`/`bg-surface-muted`、状态色 `success`/`warning`/`info`/`danger`。
  - 清理旧的 `--color-*` 与新的 `--ink-*` 混用；在 `miniprogram/styles/tailwind.input.css:1` 做映射与迁移标注。

- 主题切换可发现性
  - 在详情/分析页头部展示“当前主题”轻提示/入口，或在“更多”里提供切换。

- 视觉规范
  - 统一圆角/阴影/间距令牌（`--radius-*`、`--shadow-*`、`--space-*`），替换散落硬编码。

---

## 页面专项建议

### 住户列表页（`miniprogram/pages/index/index.wxml:180`）
- 信息层级：主信息（姓名/年龄/状态）与次信息（最近入住/医院）对齐显示，元信息（标签/次数）弱化色。
- 批量模式：吸顶工具栏展示“已选 N / 全选 / 反选 / 清空”，卡片减少与“查看”冲突的长按/滑动。
- 滚动反馈：提供“返回顶部 / 回筛选”悬浮按钮。

### 住户详情页（`miniprogram/pages/patient-detail/detail.wxml:1`）
- 渐进渲染：入院记录增加子骨架屏与“仅看最近 5/10 条”，展开查看全部。
- 区块导航：在页头加入锚点导航（基础/家庭/经济/记录/附件）。
- 状态语义：统一状态色映射（在住=success、待入住=warning、离开=default）与图标。

### 附件管理（`miniprogram/pages/patient-detail/detail.wxml:423`）
- 懒加载已加；补充显式“加载附件”按钮 + 图标，空态插画与引导 CTA。
- 控件增强：排序（时间/大小/类型）、筛选（图片/文档/可预览）、批量选择/删除。
- 操作强调：使用 `pm-button` 风格按钮，下载/删除加图标与加载/禁用态。

### 录入流程（选择/向导/完成）
- 选择页：输入高亮匹配，空态主按钮“创建新住户”（`miniprogram/pages/patient-intake/select/select.wxml:1`）。
- 向导页：逐项即时校验 + 顶部错误计数可跳转定位（`miniprogram/pages/patient-intake/wizard/wizard.wxml:35`）。
- 完成页：明确主次 CTA（查看详情/继续添加/回列表），返回自动刷新列表。

### 分析页（`miniprogram/pages/analysis/index.wxml:16`）
- 吸顶筛选条（时间/医院/状态）与筛选摘要；空数据时给出说明与返回路径。
- 图表模式偏好持久化，返回恢复。

---

## 交互与可访问性
- 反馈一致性：提交/加载/删除统一 Loading 与 Toast/Modal，危险操作使用统一 `pm-dialog` 二次确认。
- 命中区规范：按钮/图标 ≥ 44px；行内操作使用按钮组件而非文本。
- 可访问性：补齐 `aria-label` 与图标说明文本；图片失败占位/重试。

---

## 性能与加载策略
- 列表：骨架卡自适应屏高；分页与预取；`setData` 仅携带首屏必须字段。
- 详情：已并发云函数与附件懒加载；继续对入院记录使用分页/虚拟列表/分段 `setData`。
- 资源：附件缩略统一规格、懒加载与失败重试；去重 `sort/map`，减少重复计算（参考 `miniprogram/pages/patient-detail/detail.js:642`）。

---

## 文案与状态规范
- 统一语气/标点/引导动作：如“暂无权限查看附件。去联系管理员”/“暂无图片资料。立即上传”。
- 按状态分级：信息（info）/提醒（warning）/阻断（danger）/成功（success）一组样式与文案模板。

---

## 组件化与工程化
- 抽象组件：`SectionHeader`、`StatCard`、`EmptyState`、`ErrorState`、`Skeleton`、`MediaToolbar`。
- 规范落地：样式/交互规范文档 + Lint/快照脚本，防止回归。

- 路径参考
  - 列表卡片：`miniprogram/components/business/patient-card/index.wxml:1`
  - 详情附件：`miniprogram/pages/patient-detail/detail.wxml:423`
  - 主题配置：`miniprogram/styles/tailwind.input.css:1`、`miniprogram/utils/theme.js:7`

---

## 分阶段改造计划
- 第 1 阶段（1–2 周）
  - 详情页：入院记录子骨架 + “仅看最近 N 条”。
  - 附件区：按钮组件化 + 空态插画 + 懒加载按钮。
  - 统一状态色与按钮 Loading/Disabled；梳理文案模板。

- 第 2 阶段（2–4 周）
  - 列表工具栏吸顶 + 批量模式 UX。
  - 列表与详情的锚点导航。
  - 分析页吸顶筛选与筛选摘要；排序/筛选一致化。

- 第 3 阶段（持续）
  - 组件库沉淀（Skeleton/EmptyState/StatCard 等）。
  - 性能指标采集（首屏时间、接口延迟、错误率）与看板。

---

## 验收指标（KPI）
- 首屏可交互（TTI）：详情页 ≤ 2.5s（弱网 ≤ 4s）。
- 请求次数：详情页首屏 ≤ 2 个主接口；附件按需点击加载。
- 可用性：关键路径转化率 +10%，错误率下降 30%。
- 一致性：主题/文案/状态样式巡检通过率 ≥ 95%。

---

## 附：落地改动示例（参考）
- 附件懒加载：`miniprogram/pages/patient-detail/detail.wxml:423` 增加“点击加载附件”入口；`miniprogram/pages/patient-detail/detail.js:1480` 增加 `initMediaSection/ensureMediaInitialized`。
- 并发加载：`miniprogram/pages/patient-detail/detail.js:446` 使用 `Promise.all` 并发 `patientProfile` 与 `patientIntake` 调用。
- 记录列表精简：`miniprogram/pages/patient-detail/detail.js:649` 仅维护 `visibleIntakeRecords` 并分页。

---

> 如需，我可以先为“详情页入院记录的子骨架 + 仅看最近 N 条”和“附件区按钮组件化 + 排序筛选”产出一个小迭代 PR，并附带前后对比截图。
