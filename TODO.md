# TODO

## 1. 设计令牌统一化（1 Sprint）
- [x] 建立 token 源文件（JSON/TS），定义品牌色、语义色、排版、间距、阴影等。
- [x] 编写脚本（建议 Node + JSON Schema 校验），生成：
  - WXSS 片段（不使用 :root，而是输出 `.theme-root` + 工具类）。
  - JS/TS 模块，供组件在逻辑层读取。
- [x] 在 app/wxml 每个页面根节点挂载 `.theme-root` 或注入 inline style，确保全局生效。
- [ ] 编写 Stylelint 规则/CI 校验：禁止直接写裸色值，必须引用变量或工具类。
- [x] 修复 `styles/responsive.wxss` 乱码（UTF-8），并将 breakpoints 纳入 token。

## 2. 基础样式与工具类建设（1 Sprint）
- [x] 在 `styles/` 新增 `foundation.wxss`、`utilities.wxss`：
  - `foundation.wxss`：标题/正文/副标题/提示色等基准样式。
  - `utilities.wxss`：颜色、背景、间距、布局、阴影等可组合类。
- [x] 在 `app.wxss` 统一引入，并梳理所有页面引用方式。
- [ ] 将现有页面的硬编码样式迁移为工具类，拆分公共 section/card/button 布局。
  - [x] 患者档案列表（miniprogram/pages/index/index）迁移至 token/utility
  - [x] 分析总览页（miniprogram/pages/analysis/index）完成迁移
  - [x] 患者详情页（miniprogram/pages/patient-detail/detail）完成迁移
  - [x] 入住向导页（miniprogram/pages/patient-intake/wizard/wizard）完成迁移
  - [x] 患者选择页（miniprogram/pages/patient-intake/select/select）完成迁移
  - [ ] 其他页面依次迁移
- [ ] 更新 Stylelint 规则，不允许在页面内再次定义与 foundation 冲突的样式。
- [ ] 汇总迁移清单，逐页替换直写颜色/阴影为 `foundation` 与 `utilities` 变量，并在完成后补充 Stylelint 校验规则。
  - [x] 梳理仍使用 `rgba()` 的渐变、透明遮罩等样式，规划语义 token 并纳入生成脚本。→ 见 `docs/design-system/rgba-inventory.md`
  - [x] 在 `design-tokens.json` 中新增 overlay/background/gradient 令牌，并更新 `scripts/generate-tokens.js`
  - [x] 替换页面级 `rgba()` 用法为新语义令牌，清理 legacy `styles/tokens.wxss` 阴影/渐变类
  - [ ] 更新设计文档，补充 `overlay-modal`、`shadow-floating` 等新增令牌及最新使用示例
  - [ ] 将 `pages/patient-intake/success` 等仍保留裸 `#fff/#333` 颜色的页面改用语义色或实用类

## 3. 基础组件升级（2~3 Sprint）
- [ ] 规划组件 API（按钮、卡片、输入、标签等）：
  - 定义 props（type/variant/size/state）、slot、事件命名。
  - 设计文档（props + 状态矩阵 + 行为描述）。
- [ ] 重构 `pm-button`/`pm-card`/`pm-input`：
  - 接入新 token / utility。
  - 支持 slot、图标、loading、ghost/block 等变体。
  - 引入统一的状态管理（danger/warning/info）。
- [ ] 在 Component Lab 中为每个组件增加多状态示例与交互说明。
- [ ] 页面替换旧 `<view>` 仿制按钮/卡片，统一使用组件。
- [ ] 补充单元测试（miniprogram-simulate）与视觉回归用例。

## 4. 文档体系梳理（进行中）
- [ ] 对齐设计令牌文档引用，统一改为 `design-tokens.json` + `styles/generated/tokens.wxss`。
  - [x] `docs/design-system/design-tokens-spec.md`
- [ ] 清理/归档沿用旧 `styles/tokens.wxss` 流程的文档与示例，补充迁移说明。
  - [x] `docs/page-designs/design-handoff-package.md`
  - [x] `docs/design-system/coverage-report.md`
  - [x] `docs/architecture/tech-stack.md`
  - [x] `docs/architecture/coding-standards.md`
  - [x] `docs/stories/001.1.design-system-foundation.md`
- [ ] 扫描 `docs/` 目录残留引用，批量更新示例与指南中关于旧 tokens 接入方式的描述。
