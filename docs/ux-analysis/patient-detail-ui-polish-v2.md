# 住户详情页 UI 优化补充方案（v2）

> 基于现有实现精修交互细节与一致性，聚焦“更易发现的交互、更稳的触控、更清晰的层级、更友好的可达性”。本方案为 docs/ux-analysis/patient-detail-optimization-plan.md 的补充与落地细化。

## 摘要

- 目标：降低视觉噪声、统一操作语义、优化触控与可达性、完善空状态与反馈。
- 范围：`miniprogram/pages/patient-detail/*`、基础组件 `pm-button`/`pm-input` 的使用语义，以及媒体区与时间轴的微交互。
- 产出：快速可落地改动清单 + 分主题实施要点 + 验收标准。

---

## 快速可落地（建议本周完成）

1) 状态卡支持“点按 + 长按”双入口
- 现状：仅 `bindlongpress`（WXML: `patient-detail/detail.wxml` 行 50-57）。
- 方案：同时绑定 `bindtap="onStatusLongPress"`，并在卡片右上角增加“调整”轻文案，降低学习成本。
- 影响：`detail.wxml` 状态卡片；`detail.js` 无需改名（共用处理函数）。

2) 安全区适配，避免底部被系统手势遮挡
- 现状：` .detail-scroll` 无底部安全区。
- 方案：在 `detail.wxss` 的 `.detail-scroll` 增加：
  ```css
  padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
  ```

3) 统一操作语义与触控反馈（媒体区“下载/删除”）
- 现状：使用自定义 `view`，缺少语义与按压反馈（WXML: 行 381-396, 436-452）。
- 方案：优先替换为 `<pm-button size="small">`；如暂不替换，需补充 `role="button"`、`hover-class`、`aria-label` 并提升最小高度至 ≥72rpx。

4) 标签与排序按钮的按压反馈与可达性
- 现状：`media-tab-button`、`sort-button` 缺少 hover/aria（WXML: 行 323-334；WXSS: 939-986）。
- 方案：为 Tab 与排序按钮增加 `hover-class`、`aria-pressed/aria-selected`，并确保触控目标 ≥88rpx。

5) 空状态插画与操作指引
- 现状：仅“暂无图片/文档资料”。
- 方案：引入轻量插画（`miniprogram/assets/images/empty-patients.svg` 可复用）+ 主 CTA（上传/添加），提升可操作性。

---

## 信息层级与视觉

- 渐变降噪与层级收敛
  - 问题：信息卡片渐变使用偏多（`detail.wxss` 1148-1208），整体略花。
  - 方案：保留弱渐变或顶部 6rpx 色条，主体面统一为 `--color-bg-primary`；保持标题/分隔线对比度。

- 关键信息就近展示
  - 建议在姓名右侧补充“性别/年龄/证件尾号（脱敏）”，减少纵向寻迹（`detail.wxml` 44-71）。

- 时间轴展开的图形化反馈
  - 将“展开/收起”文字改为旋转的 ▶ 图标；保留时长徽章（`detail.wxml` 172-174，`detail.wxss` 动画可复用）。

---

## 表单与校验

- 字段级错误提示就地显示
  - 使用 `pm-input` 的 `error`/`helper` 属性，必填校验失败时标红并给出提示（`pm-input` 组件已支持）。

- 选择器与占位态统一
  - 日期/时间选择器在未选择时使用次要色占位；错误时统一轻提示。参考 `detail.wxml` 541-561。

- 触控尺寸一致化
  - 自定义按钮（如 `.doc-action-button`、`.media-card__button`）最小高度与 `pm-button` 对齐（≥72rpx），提升触控成功率。

---

## 资料管理体验

- 上传反馈粒度
  - 在全局“上传中…”之外，为每个文件提供进度与队列序号；失败可重试并提供错误原因。

- 文本预览与回退
  - 对纯文本 `txt` 采用内嵌预览（已实现预览面板），失败时提供“下载到本地”回退路径。

- 空状态增强
  - 添加插画 + 引导文案 + 主按钮（上传图片/文档），使用户下一步明确。

---

## 可达性与一致性

- 语义标签与 ARIA
  - 为可点击的 `view/text` 增加 `role="button"`、`aria-label`；Tab 加 `role="tab"`、`aria-selected`；提升读屏与键盘可达性（与 `pm-button` 的做法保持一致）。

- 图标一致化
  - 将 emoji 替换为统一的 IconFont/SVG 方案，避免跨平台渲染差异，便于深色模式适配（涉及状态卡与记录预览小图标）。

---

## 主题与动效

- 暗色模式对比度
  - 检查渐变与文字的对比度（尤其信息卡与状态卡），必要时调整 token 色阶，确保可读性。

- 动效节奏统一
  - 交互过渡统一在 120–200ms；与时间轴的展开动画保持一致，避免杂乱的动效体验。

---

## 代码落地建议（片段）

- 状态卡支持点按：`detail.wxml`
  ```wxml
  <view
    class="metric-card metric-card--status status-{{patient.statusClass || 'unknown'}}"
    bindtap="onStatusLongPress"
    bindlongpress="onStatusLongPress"
  >
  ```

- 安全区适配：`detail.wxss`
  ```css
  .detail-scroll {
    padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
  }
  ```

- 文档操作语义化（示例保底做法）：`detail.wxml`
  ```wxml
  <view class="doc-action-button"
        role="button"
        hover-class="hover"
        aria-label="下载 {{item.displayName}}"
        catchtap="onDocumentDownloadTap" />
  ```

- Tab 可达性（示例）：`detail.wxml`
  ```wxml
  <view class="media-tab-button {{media.tab==='images'?'active':''}}"
        role="tab"
        aria-selected="{{media.tab==='images'}}"
        data-tab="images"
        hover-class="hover"
        bindtap="onMediaTabChange">照片墙</view>
  ```

---

## 验收标准（补充）

- 操作可发现性
  - [ ] 状态卡点按可打开状态弹窗
  - [ ] 媒体区操作具备按压反馈与语义标签
  - [ ] 空状态含插画与明显的主 CTA

- 触控与可达性
  - [ ] 所有可点击区域 ≥72rpx（关键操作 ≥88rpx）
  - [ ] 关键按钮具备 `aria-label`，Tab 具备 `aria-selected`

- 视觉一致性
  - [ ] 信息卡片渐变收敛为弱化样式
  - [ ] 暗色模式对比度达标（正文文本对比度 ≥ 4.5:1）

---

## 实施计划（建议排期 1–2 天）

Day 1
- 点按状态卡、媒体操作语义化、安全区适配
- Tab/排序按钮 hover 与 ARIA 标签、空状态插画与 CTA

Day 2
- 表单错误就地提示、触控尺寸对齐
- 时间轴图标化折叠、动效节奏统一

---

## 进展记录（持续更新）

更新时间：2025-10-09

已完成（代码已提交至 `miniprogram/pages/patient-detail/`）
- [x] 状态卡支持点按打开状态弹窗（同时保留长按）
- [x] `.detail-scroll` 增加安全区底部内边距（`env(safe-area-inset-bottom)`）
- [x] 媒体区“下载/删除”按钮补充 `role="button"`、`hover-class` 与 `aria-label`，并统一最小高度 ≥72rpx
- [x] `media-tabs` 增加 `role="tablist"`，单个 Tab 增加 `role="tab"` 与 `aria-selected`；排序按钮增加按压反馈与 `aria-label`
- [x] 图片/文档为空时，增加轻量空状态与“上传”主按钮 CTA
- [x] 媒体区操作按钮替换为 `pm-button size="small"`，统一视觉/状态/触控反馈
- [x] 时间轴“展开/收起”替换为旋转箭头（▶），展开时旋转 90°
- [x] 状态卡右上角增加“调整”轻文案入口（与点按/长按一致）
- [x] 模块编辑弹窗对必填字段使用 `pm-input` 的 `error` 就地提示（姓名/证件号/性别/出生日期/地址/备用电话）
 - [x] 姓名行补充“性别/年龄/证件尾号（脱敏）”，就近展示关键信息

待办/建议（下一步）
- [ ] 统一图标体系（替换 emoji 为 IconFont/SVG，并适配暗色）
- [ ] 媒体上传逐文件进度与队列序号；失败重试入口与错误提示细化

## 变更影响面

- UI 视觉与交互统一度提升，风险低、回归点集中在 `patient-detail` 页面与媒体操作。
- 与 v1 方案互补：不引入新组件，均为样式与语义层的精修。

---

文档版本：v2.0
创建时间：2025-10-09
维护人：前端/设计协作组
关联文件：
- miniprogram/pages/patient-detail/detail.wxml
- miniprogram/pages/patient-detail/detail.wxss
- miniprogram/pages/patient-detail/detail.js
- miniprogram/components/base/pm-button/
- miniprogram/components/base/pm-input/
