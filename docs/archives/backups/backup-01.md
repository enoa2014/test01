# TODO

## 0. 当前优先事项（2025-10-02 更新）

- [x] 排查患者入住向导对“已存在患者”流程偶发未跳转成功页的根因，并移除 E2E 兜底逻辑
  - [x] 真机环境验证云函数可用时不会触发本地 fallback，并观察日志
- [x] 将现有 textarea 场景迁移为 `pm-input` 的 `type="textarea"`，验证自动高度与校验体验
  - [x] Component Lab 中 textarea demo 兼容新版属性（保持体验一致）
- [x] 补充 Component Lab 与文档，覆盖 `pm-input` 新增属性（`maxlength`、`textareaAutoHeight`、textarea 事件）
  - [x] 更新组件库文档说明 textarea 能力
- [x] 入住次数与历史列表一致性修复（高优先级）
  - [x] 梳理 `getAllIntakeRecords` 返回的 imported/active/excel 记录结构
  - [x] 调整 `dedupeIntakeRecords` 逻辑，基于 intakeTime+诊断等字段去重并优先保留有效记录
  - [x] 梳理 `getAllIntakeRecords` 返回的 imported/active/excel 记录结构
  - [x] 调整 `dedupeIntakeRecords` 逻辑，基于 intakeTime+诊断等字段去重并优先保留有效记录
  - [x] 恢复云函数 `handleSubmitIntake` 对 `admissionCount` 的自增，确认“已有患者新增入住”不会漏记次数
  - [x] 回归患者详情页与患者列表页，确保历史条数与入住次数一致
  - [x] 新增 `dedupeIntakeRecords` 单元测试覆盖状态优先级、时间排序与 Excel 导入场景
- [x] 排查并修复“胡矩豪入院记录不一致”事件（高优优先）
  - [x] `patientIntake.getAllIntakeRecords` 过滤掉 `_id` 以 `-excel` 结尾的聚合记录，并保留 doctor/hospital 字段
  - [x] 调整详情页记录展示逻辑，直接使用接口返回信息避免跨记录回填
- [x] 修复患者选择页搜索/分页数据源混用（影响患者检索）
  - [x] 保留完整患者列表副本，并新增 `displayPatients`/`filteredPatients` 等独立状态
  - [x] 重写 `applySearch` 与 `onLoadMore`，基于完整列表做筛选与增量拼接
  - [x] 调整缓存加载逻辑，首屏展示使用切片但不覆盖完整列表，验证搜索后可匹配未分页数据
  - [x] 补充单元/页面测试，覆盖“关键词命中第 N 页患者”与“清除搜索恢复分页”场景
- [x] 完善全局日期解析与年龄展示逻辑（避免合法时间戳被清空）
  - [x] 扩展 `parseDateValue` 支持秒级/毫秒级时间戳与常见日期格式，并对非法值返回 `null`
  - [x] 更新首页、分析页、患者选择页等使用场景，确认 `formatDate`/`formatAge` 输出正确
  - [x] 为日期/年龄计算增加单元测试（含边界：闰年、未来日期、纯年份、字符串时间戳）
- [x] 修正分析页“按最近入住月份分析”的排序规则
  - [x] 使用 `sortKey` 与定制 comparator，按时间倒序排列并保留未知月份在末尾
  - [x] 补充面板排序测试验证月份顺序与“未知月份”位置
- [x] 抽取日期/年龄工具为公共模块
  - [x] 新增 `utils/date.js`（或合适位置）承载 `parseDateValue/formatDate/formatAge`
  - [x] 替换各页面重复定义，统一引用公共工具并清理冗余代码
  - [x] 在工具层补充单元测试，确保未来改动易于回归
- [x] 清理 Jest Haste 模块命名冲突警告
  - [x] 在 `tests/unit/jest.config.js` 中排除 `tools/cloudbase-cli` 与 `tcb-cli`
  - [x] 验证单元测试执行时不再输出重复包名警告
- [x] 推进 PM-Card 页面替换与回归，完成分析页/患者详情媒体卡片迁移
  - [x] 入住成功页卡片视图改用 `pm-card`，统一提醒与操作布局
  - [x] 分析页统计卡片已使用 `pm-card`，确认交互与样式无回归
  - [x] 患者详情媒体卡片采用 `pm-card` 结构，保持上传/预览操作一致
- [x] 完成患者向导/详情页面的手工回归，签出清除按钮、提示文案与错误态（单元测试覆盖关键交互）

## 1. 设计令牌统一化（1 Sprint）

- [x] 建立 token 源文件（JSON/TS），定义品牌色、语义色、排版、间距、阴影等。
- [x] 编写脚本（建议 Node + JSON Schema 校验），生成：
  - WXSS 片段（不使用 :root，而是输出 `.theme-root` + 工具类）。
  - JS/TS 模块，供组件在逻辑层读取。
- [x] 在 app/wxml 每个页面根节点挂载 `.theme-root` 或注入 inline style，确保全局生效。
- [x] 编写 Stylelint 规则/CI 校验：禁止直接写裸色值，必须引用变量或工具类。
  - [x] 引入 `.stylelintrc.cjs` 并配置 `color-no-hex`、`function-disallowed-list` 等规则
  - [x] 在 `package.json` 新增 `lint:style` 脚本与 lint-staged 钩子
- [x] 修复 `styles/responsive.wxss` 乱码（UTF-8），并将 breakpoints 纳入 token。

## 2. 基础样式与工具类建设（1 Sprint）

- [x] 在 `styles/` 新增 `foundation.wxss`、`utilities.wxss`：
  - `foundation.wxss`：标题/正文/副标题/提示色等基准样式。
  - `utilities.wxss`：颜色、背景、间距、布局、阴影等可组合类。
- [x] 在 `app.wxss` 统一引入，并梳理所有页面引用方式。
- [x] 将现有页面的硬编码样式迁移为工具类，拆分公共 section/card/button 布局。（详见 `docs/design-system/token-migration-summary.md`）
  - [x] 患者档案列表（miniprogram/pages/index/index）迁移至 token/utility
  - [x] 分析总览页（miniprogram/pages/analysis/index）完成迁移
  - [x] 患者详情页（miniprogram/pages/patient-detail/detail）完成迁移
  - [x] 入住向导页（miniprogram/pages/patient-intake/wizard/wizard）完成迁移
  - [x] 患者选择页（miniprogram/pages/patient-intake/select/select）完成迁移
  - [x] 其他页面依次迁移（analysis、index、patient-detail、patient-intake/\*、component-lab 均已接入令牌，`npm run lint:style` 全部通过）
    - [x] 组件实验室（miniprogram/pages/component-lab/index）完成迁移
- [x] 更新 Stylelint 规则，不允许在页面内再次定义与 foundation 冲突的样式。
  - [x] 新增 `project/no-foundation-overrides` Stylelint 插件，限制 `.h1` 等基础类再定义
  - [x] 修复受影响页面样式（index、patient-intake/select）并通过 `lint:style`
- [x] 汇总迁移清单，逐页替换直写颜色/阴影为 `foundation` 与 `utilities` 变量，并在完成后补充 Stylelint 校验规则。
  - [x] 梳理仍使用 `rgba()` 的渐变、透明遮罩等样式，规划语义 token 并纳入生成脚本。→ 见 `docs/design-system/rgba-inventory.md`
  - [x] 在 `design-tokens.json` 中新增 overlay/background/gradient 令牌，并更新 `scripts/generate-tokens.js`
  - [x] 替换页面级 `rgba()` 用法为新语义令牌，清理 legacy `styles/tokens.wxss` 阴影/渐变类
  - [x] 更新设计文档，补充 `overlay-modal`、`shadow-floating` 等新增令牌及最新使用示例
  - [x] 将 `pages/patient-intake/success` 等仍保留裸 `#fff/#333` 颜色的页面改用语义色或实用类
  - [x] 输出页面迁移清单与校验说明 → `docs/design-system/token-migration-summary.md`
  - [x] 在设计系统文档中补充“新增 token 需同步生成文件（styles/generated/tokens.wxss）”流程提示或脚本

## 3. 基础组件升级（2~3 Sprint）

- [x] 规划组件 API（按钮、卡片、输入、标签等）：
  - 定义 props（type/variant/size/state）、slot、事件命名。→ 见 `docs/components/base-component-api-plan.md`
  - 设计文档（props + 状态矩阵 + 行为描述）。
- [x] 编写开发者培训计划，指导组件升级落地 → `docs/components/developer-training-plan.md`
- [ ] 重构 `pm-button`/`pm-card`/`pm-input`：
  - 接入新 token / utility。
  - 支持 slot、图标、loading、ghost/block 等变体。
  - 引入统一的状态管理（danger/warning/info）。
  - [ ] 实施计划：
    - [x] `pm-button`：依据 `base-component-api-plan` 增加 icon/elevated/danger 逻辑，实现 props 类型定义，补充多状态样式。
    - [x] `pm-card`：拆分 header/body/footer slot，支持 `variant`、`status`；同步 Jest 测试。
      - [ ] 页面回归：巡检现有使用场景（患者列表、家庭页等），确认状态条与 hover 动效符合预期。
    - [x] `pm-input`：完善 helper/error/prefix/suffix 逻辑，增加受控模式测试。
      - [ ] 页面回归：检查患者详情、向导等表单是否保持正确布局与焦点状态。
- [x] 在 Component Lab 中为每个组件增加多状态示例与交互说明。（组件实验室 presets 覆盖按钮/输入/卡片常见状态）
- [ ] 页面替换旧 `<view>` 仿制按钮/卡片，统一使用组件。
  - [ ] 列出影响页面：index、patient-detail、patient-intake 系列；逐页替换并记录兼容性检查。
    - [x] patient-intake/select 底部行动按钮与确认弹窗采用 `pm-button`，待线上回归确认交互一致。
    - [x] patient-intake/success 快捷操作与底栏接入 `pm-button`，确认真机尺寸与布局无异常。
    - [x] index 页面悬浮新增按钮改用 `pm-button` icon-only 预设
    - [x] patient-intake/wizard 底部/草稿操作按钮替换为 `pm-button`，清理 `.btn*` 样式
  - [x] Component Lab 新增 icon-only/ripple 支持以辅助验证（2025-10-02）
- [ ] 补充单元测试（miniprogram-simulate）与视觉回归用例。
  - [ ] 为基础组件编写视觉基线（可结合 Component Lab 截图），在 CI 中执行。

### 3.1 基础组件UI优化（新增 - 2025-09-30）

- [x] **设计系统一致性统一**（✅ 2025-09-30 完成）
  - [x] 统一圆角规范并更新 design-tokens.json
    - [x] 定义圆角体系：sm(8rpx)、base(12rpx)、md(16rpx)、lg(20rpx)、xl(24rpx)、xxl(32rpx)、full(9999rpx)
    - [x] 执行 `npm run tokens:generate` 生成新的 tokens.wxss
  - [x] 统一阴影规范（已有完善的阴影令牌定义）
    - [x] 阴影层级：xs、sm、base、md、lg、xl、floating、以及各状态色阴影
    - [x] 使用具体 rgba 值定义

- [x] **PM-Button 组件优化**（✅ 2025-09-30 完成）
  - [x] 修复 ghost 按钮 CSS 优先级问题
  - [x] 优化文字居中对齐（flex布局 + line-height: 1）
  - [x] 添加 default 类型样式（浅灰背景）
  - [x] 添加渐变背景和投影效果
  - [x] 优化交互动画（scale + 投影变化）
  - [x] 统一圆角为 12rpx（使用 var(--radius-base)）
  - [x] 添加 ripple 波纹点击效果（icon-only 同步支持 aria-label）
  - [ ] 优化 loading 状态的 spinner 样式（低优先级）
  - [x] 支持 icon-only 模式（新属性 iconOnly，默认尺寸 72rpx）

- [x] **PM-Input 组件样式优化**（✅ 2025-09-30 完成）
  - [x] 圆角统一使用 var(--radius-base) (12rpx)
  - [x] 增强 focus 状态视觉效果
    - [x] 添加外发光效果：`box-shadow: 0 0 0 4rpx rgba(24, 144, 255, 0.1)`
    - [x] 使用流畅的 cubic-bezier 过渡动画
  - [x] 优化 clearable 清除按钮样式
    - [x] 圆形背景（var(--radius-full)）+ 居中图标
    - [x] 尺寸 32rpx × 32rpx
    - [x] 添加点击缩放反馈

- [x] **PM-Card 组件交互优化**（✅ 2025-09-30 完成）
  - [x] 统一圆角为 16rpx（var(--radius-md)）
  - [x] 使用具体阴影值 `0 2rpx 8rpx rgba(0, 0, 0, 0.08)`
  - [x] 优化状态条设计：添加右下圆角 `border-radius: 0 0 8rpx 0`
  - [x] 增强 clickable 交互反馈
    - [x] 优化 active 状态的缩放和阴影
    - [x] 使用流畅的 cubic-bezier 过渡动画
  - [x] elevated variant 使用具体阴影值

- [ ] **新组件创建**（建议下一阶段）
  - [ ] PM-Modal 通用弹窗组件
    - [ ] 支持自定义标题、内容、按钮配置
    - [ ] 内置动画效果（淡入 + 上滑）
    - [ ] 支持遮罩层点击关闭
    - [ ] 支持插槽自定义内容
  - [x] PM-Dialog 确认对话框组件
    - [x] 基于 PM-Modal 封装（API 规划）
    - [x] 预设确认、取消按钮样式
    - [x] 支持 confirm/cancel 回调
    - [x] 实现组件并补充 Component Lab 示例（含危险确认场景）
  - [x] PM-Badge 徽章组件（可选）
    - [ ] 为 PM-Badge 增补 Component Lab 交互演示与自动化覆盖
  - [ ] PM-Avatar 头像组件（可选）

- [ ] **组件文档更新**（建议下一阶段）
  - [x] 更新 docs/components/ 中的组件 API 文档
  - [x] 补充设计原则和使用示例
  - [x] 添加最佳实践和注意事项
  - [ ] 更新 Component Lab 演示页面

### 3.2 组件优化后续任务（2025-09-30 完成）

- [x] **组件测试与验证**（✅ 2025-09-30 完成）
  - [x] 更新 Component Lab 中的组件示例
    - [x] PM-Button: 新增7个预设（主操作、默认按钮、加载、Ghost、带图标、危险、块级）
    - [x] PM-Input: 新增6个预设（基础、带内容、错误、插槽、禁用、大尺寸）
    - [x] PM-Card: 新增7个预设（默认、信息、成功、警告、危险、投影、自定义）
  - [ ] 测试不同尺寸和状态下的组件表现（待真机测试）
  - [ ] 验证真机上的交互反馈和动画流畅度（待真机测试）
  - [ ] 检查所有使用组件的页面是否需要调整（待页面回归）

- [x] **圆角令牌使用规范文档**（✅ 2025-09-30 完成）
  - [x] 编写圆角使用指南 → `docs/design-system/radius-usage-guide.md`
  - [x] 定义7个圆角层级的使用场景和最佳实践
  - [x] 提供迁移指南和常见问题解答
  - [x] 创建组件圆角参考表

### 3.3 组件使用情况分析（2025-09-30 完成）

**组件在页面中的使用统计**：

- ✅ **PM-Button**: 已在2个页面使用
  - `pages/patient-intake/select` - 患者选择页（底部行动按钮、确认弹窗）
  - `pages/patient-intake/success` - 入住成功页（快捷操作、底部按钮）
- ⚠️ **PM-Input**: 统计需更新 —— 实际已在 patient-detail、patient-intake 等页面使用，待修正文档
- ⚠️ **PM-Card**: 统计需更新 —— 实际已在 patient-detail 媒体卡片、analysis 面板使用

**页面中使用原生元素的情况**：

- `pages/patient-detail/detail` - 使用原生 `<input>` 和自定义 `.media-card` 样式
- `pages/patient-intake/wizard` - 使用原生 `<input>` 和 `<textarea>`
- `pages/analysis/index` - 使用自定义 `.stat-card` 样式

### 3.4 组件推广建议（2025-09-30 新增）

- [x] **PM-Input 组件推广 - 患者详情页**（✅ 2025-09-30 完成）
  - [x] 患者详情页表单迁移到 PM-Input
    - [x] 注册 pm-input 组件（detail.json）
    - [x] 替换基础信息字段的原生 `<input>`（patientFieldConfig）
    - [x] 替换联系信息字段的原生 `<input>`（contactFieldConfig）
    - [x] 替换入住信息字段的原生 `<input>`（intakeFieldConfig）
    - [x] 清理 WXSS 中的 `.text-input` 样式
    - [x] 保留 picker、date picker 和 textarea 原有样式
    - [x] 应用统一 props：label-position="top", block, clearable, error支持
  - [x] **待测试**：新增单元测试覆盖编辑模式、校验与保存流程（tests/unit/pages/patient-detail-edit.test.js）

- [x] **PM-Input 组件推广 - 入住向导页**（✅ 2025-09-30 完成）
  - [x] 入住向导页表单迁移
    - [x] 注册 pm-input 组件（wizard.json）
    - [x] 替换第1步（患者基础信息）的 2 个原生 input（姓名、证件号码、联系电话）
    - [x] 替换第2步（家庭与联系人）的 4 个原生 input（紧急联系人、紧急联系人电话、备用联系人、备用联系人电话）
    - [x] 保留 textarea（常住地址、入住理由说明）和 picker/radio-group 原有样式
    - [x] 清理 WXSS 中的 `.form-input` 样式
    - [x] 应用统一 props：label-position="top", block, clearable, required, hint 支持
  - [x] **向导测试**：新增单元测试覆盖路径切换、校验与提交（tests/unit/pages/patient-intake-wizard.test.js）

- [ ] **PM-Card 组件推广**（中优先级）
  - [x] 分析页统计卡片迁移
    - [x] 替换 `.stat-card` 为 PM-Card
    - [x] 使用 status 和 variant 属性
    - [x] 更新 docs/business-components/integration-guide.md 示例，统一说明改用 PM-Card
  - [x] 患者详情页媒体卡片迁移
    - [x] 替换 `.media-card` 为 PM-Card + 自定义 slot
    - [x] 保持现有交互功能

  - [ ] **页面回归测试**（高优先级 - 新增 2025-09-30）
  - [ ] patient-detail 页面（已迁移 PM-Input）
    - [x] 测试编辑模式下核心字段（单元测试覆盖）
    - [x] 验证表单验证逻辑（必填项、格式校验）
    - [x] 测试清除按钮功能（单元测试覆盖 clearable 行为）
    - [x] 测试错误提示显示
    - [x] 验证数据保存功能
  - [ ] patient-intake/wizard 页面（已迁移 PM-Input）
    - [x] 测试完整向导流程（单元测试覆盖 4 步）
    - [x] 验证步骤切换和必填项校验
    - [x] 验证字段类型（text/number）与提示文案（单元测试覆盖 WXML 定义）
    - [x] 测试数据提交功能
    - [x] 通过单元测试确保已存在患者提交保留 patientKey（模拟验证）
  - [ ] patient-intake/select 页面（已使用 PM-Button）
  - [ ] patient-intake/success 页面（已使用 PM-Button）
  - [x] 验证圆角令牌应用后的视觉一致性（移除残留裸值，均改用 `var(--radius-*)`）
  - [x] 首页 admissions 自动化用例兼容更新（为成功页主按钮补充 `.primary-btn` 类）

### 3.5 PM-Input 迁移总结与后续建议（2025-09-30）

**迁移完成情况**：

- ✅ 患者详情页：已迁移所有文本输入框（3个区域共约10个字段）
- ✅ 入住向导页：已迁移所有文本输入框（7个字段）
- ✅ 保留了 textarea、picker、radio-group 等特殊表单组件的原有实现
- ✅ 应用了统一的组件 props：label-position="top", block, clearable, error, hint, required

**PM-Input 组件优势**：

1. **统一体验**：所有输入框具有一致的视觉风格和交互反馈
2. **内置功能**：清除按钮、错误提示、提示文本、必填标记等开箱即用
3. **易于维护**：样式和逻辑集中管理，修改一处全局生效
4. **响应式布局**：支持 label-position 和 block 属性，适配不同场景
5. **设计令牌**：使用设计系统令牌，确保视觉一致性

**待优化项**：

- [x] PM-Input 组件支持 type="textarea" 模式，统一 textarea 样式
- [x] 考虑为 picker 创建 PM-Picker 组件
- [x] 实现 PM-Picker 组件（依据 base-component-api-plan 中的 API 规格）
- [ ] 为 PM-Picker 增补 Component Lab 预设与 E2E 覆盖
- [x] 考虑为 radio-group 创建 PM-Radio 组件
- [ ] 实现 PM-Radio 组件，实现单选与按钮样式模式（参考 base-component-api-plan）

- [x] 将现有 textarea 使用场景迁移为 `pm-input` 的 `type="textarea"`，验证自动高度与校验体验
- [x] 更新组件文档与 Component Lab 示例，补充 textarea 属性（`maxlength`、`textareaAutoHeight` 等）
  - [x] Component Lab：当输入类型非 `textarea` 时禁用或隐藏 `textareaAutoHeight`、`showConfirmBar` 控制，避免误用

### 3.6 下一阶段建议（2025-09-30 更新）

- [ ] **真机测试与验证**
  - [ ] 在真实设备上测试所有优化的组件
  - [ ] 验证动画流畅度（目标：60fps）
  - [ ] 检查不同屏幕尺寸下的表现
  - [ ] 记录需要调整的问题

- [ ] E2E 数据清理与自动触发诊断
  - [x] 调研 `mpflow-service test:e2e` 二次触发原因，关闭 watch 或退出自动化
    - [ ] 如后续接入 CI，验证 `CI=1` 脚本对云端流水线的兼容性
  - [x] 在测试收尾阶段执行 `scripts/e2e/verify-cleanup.js --cleanup`，清理自动化生成的患者

- [ ] **性能优化**
  - [ ] 使用开发者工具检查动画性能
  - [ ] 优化组件渲染性能（必要时）
  - [ ] 考虑添加组件懒加载（低优先级）

- [ ] **可访问性增强**（低优先级）
  - [x] 为按钮添加 aria-label 支持（示例：pm-button icon-only 属性结合 ariaLabel）
  - [ ] 优化键盘导航支持
  - [ ] 增强色盲友好的状态提示

- [ ] **文档完善**
- [x] 更新组件 API 文档，补充新增功能
  - [x] 在设计令牌文档中引用圆角使用指南
  - [x] 创建组件最佳实践示例库

## 4. 文档体系梳理（进行中）

- [x] 对齐设计令牌文档引用，统一改为 `design-tokens.json` + `styles/generated/tokens.wxss`。→ 见 `docs/design-system/doc-alignment-report.md`
  - [x] `docs/design-system/design-tokens-spec.md`
- [x] 清理/归档沿用旧 `styles/tokens.wxss` 流程的文档与示例，补充迁移说明。
  - [x] `docs/page-designs/design-handoff-package.md`
  - [x] `docs/design-system/coverage-report.md`
  - [x] `docs/architecture/tech-stack.md`
  - [x] `docs/architecture/coding-standards.md`
  - [x] `docs/stories/001.1.design-system-foundation.md`
- [x] 扫描 `docs/` 目录残留引用，批量更新示例与指南中关于旧 tokens 接入方式的描述。（参考 `docs/design-system/doc-alignment-report.md`）
  - [x] 更新 `docs/design-system/figma-tokens-guide.md` 同步新生成流程
  - [x] 调整 `docs/design-system/design-tokens-spec.md` 目录结构与警示
  - [x] 更新 `docs/design-system/rgba-inventory.md` 对 legacy 文件的描述
  - [x] 更新 `docs/dev-environment/setup.md` 脚本与 lint-staged 配置示例
  - [x] 巡检 `docs/stories` 与剩余指南，确认无 legacy tokens 残留引用

## 5. 缺陷排查记录（2025-10-05）

- [ ] 患者详情页释放资源（cc.md P0 问题1）
  - [x] `onUnload` 调用新增的 `disposeMediaService`，重置 `profileKey/patientKey` 等引用以避免页面多次进入后残留闭包
  - [x] 补充单元测试或手工验证，确认多次进入/退出不会出现内存告警
- [ ] 入住向导草稿定时器治理（cc.md P0 问题2）
  - [x] `onSubmit` 提交前调用 `stopDraftAutoSave()`，失败时重启定时器，成功后不再触发草稿保存
  - [ ] 验证提交成功、失败及草稿恢复流程，确保控制台无 “setInterval 已销毁页面” 报错
