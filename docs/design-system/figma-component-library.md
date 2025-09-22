# Figma 组件库建设指南

## 概述

本文档为在Figma中创建完整的患者档案管理系统组件库提供详细指导，包含所有基础组件的设计规范、变体配置和使用说明。

## 组件库结构

### 文件架构
```
📁 患者档案管理系统组件库/
├── 📄 🎨 Design System Tokens    # 设计令牌定义
├── 📄 ⚛️ Atomic Components       # 原子组件 (20个)
├── 📄 🧩 Molecular Components    # 分子组件 (15个)
├── 📄 🏗️ Organism Components     # 有机组件 (12个)
├── 📄 📱 Templates & Layouts     # 模板和布局
├── 📄 🎯 Icons & Assets         # 图标和资源
└── 📄 📖 Documentation          # 使用文档
```

## 原子组件详细设计 (20个)

### 1. Button 按钮组件

#### Figma组件设置
**组件名称**: `atom/button`

**属性 (Properties)**:
```yaml
variant (Variant):
  - primary (默认)
  - secondary
  - outline
  - text

size (Variant):
  - small
  - medium (默认)
  - large

state (Variant):
  - default (默认)
  - hover
  - active
  - disabled
  - loading

icon (Boolean): false (默认)
icon-position (Variant): left, right
```

**尺寸规格**:
```yaml
Small:
  height: 32px
  padding: 6px 12px
  font-size: 12px
  border-radius: 6px

Medium:
  height: 40px
  padding: 12px 24px
  font-size: 14px
  border-radius: 8px

Large:
  height: 48px
  padding: 16px 32px
  font-size: 16px
  border-radius: 8px
```

**设计令牌使用**:
```yaml
Primary:
  fill: {color.primary.base}
  text: {color.white}

Secondary:
  fill: {color.secondary.base}
  text: {color.white}

Outline:
  fill: transparent
  border: 2px {color.primary.base}
  text: {color.primary.base}

Text:
  fill: transparent
  text: {color.primary.base}
```

### 2. Input 输入框组件

#### Figma组件设置
**组件名称**: `atom/input`

**属性 (Properties)**:
```yaml
type (Variant):
  - text (默认)
  - password
  - search
  - email
  - number

state (Variant):
  - default (默认)
  - focus
  - error
  - success
  - disabled

size (Variant):
  - medium (默认)
  - large

has-label (Boolean): true (默认)
has-placeholder (Boolean): true (默认)
has-icon (Boolean): false
icon-position (Variant): left, right
```

**尺寸规格**:
```yaml
Medium:
  height: 44px
  padding: 12px 16px
  font-size: 14px
  border-radius: 8px

Large:
  height: 52px
  padding: 16px 20px
  font-size: 16px
  border-radius: 8px
```

**状态设计**:
```yaml
Default:
  fill: {color.bg.primary}
  border: 2px {color.border.primary}
  text: {color.text.primary}

Focus:
  border: 2px {color.primary.base}
  shadow: {shadow.primary}

Error:
  border: 2px {color.error}
  shadow: {shadow.error}

Success:
  border: 2px {color.success}
  shadow: {shadow.success}

Disabled:
  fill: {color.bg.tertiary}
  text: {color.text.disabled}
```

### 3. Checkbox 复选框组件

#### Figma组件设置
**组件名称**: `atom/checkbox`

**属性 (Properties)**:
```yaml
checked (Boolean): false (默认)
indeterminate (Boolean): false
disabled (Boolean): false
has-label (Boolean): true (默认)
```

**尺寸规格**:
```yaml
checkbox-size: 16px
border-radius: 4px
border-width: 2px
label-spacing: 8px
```

**状态设计**:
```yaml
Unchecked:
  fill: transparent
  border: 2px {color.border.primary}

Checked:
  fill: {color.primary.base}
  border: 2px {color.primary.base}
  icon: check (white)

Indeterminate:
  fill: {color.primary.base}
  border: 2px {color.primary.base}
  icon: minus (white)

Disabled:
  fill: {color.bg.tertiary}
  border: 2px {color.border.tertiary}
  opacity: 0.5
```

### 4. Radio Button 单选按钮组件

#### Figma组件设置
**组件名称**: `atom/radio`

**属性 (Properties)**:
```yaml
selected (Boolean): false (默认)
disabled (Boolean): false
has-label (Boolean): true (默认)
```

**尺寸规格**:
```yaml
radio-size: 16px
border-radius: 50%
border-width: 2px
inner-circle: 6px
label-spacing: 8px
```

### 5. Switch 开关组件

#### Figma组件设置
**组件名称**: `atom/switch`

**属性 (Properties)**:
```yaml
checked (Boolean): false (默认)
disabled (Boolean): false
size (Variant):
  - medium (默认)
  - large
```

**尺寸规格**:
```yaml
Medium:
  width: 44px
  height: 24px
  thumb-size: 20px
  border-radius: 12px

Large:
  width: 52px
  height: 28px
  thumb-size: 24px
  border-radius: 14px
```

### 6. Badge 徽章组件

#### Figma组件设置
**组件名称**: `atom/badge`

**属性 (Properties)**:
```yaml
variant (Variant):
  - primary (默认)
  - success
  - warning
  - error
  - info
  - neutral

size (Variant):
  - small (默认)
  - medium

type (Variant):
  - label
  - count
  - dot
```

**尺寸规格**:
```yaml
Small:
  height: 16px
  padding: 2px 6px
  font-size: 10px
  border-radius: 8px

Medium:
  height: 20px
  padding: 4px 8px
  font-size: 12px
  border-radius: 10px

Count:
  min-width: 16px
  height: 16px
  border-radius: 50%

Dot:
  width: 8px
  height: 8px
  border-radius: 50%
```

### 7. Icon 图标组件

#### Figma组件设置
**组件名称**: `atom/icon`

**属性 (Properties)**:
```yaml
name (Instance Swap): icon-library
size (Variant):
  - xs (12px)
  - sm (16px)
  - md (20px) (默认)
  - lg (24px)
  - xl (32px)

color (Variant):
  - primary
  - secondary
  - tertiary
  - disabled
```

**图标库分类**:
```yaml
System Icons:
  - home, settings, search, refresh, close
  - add, delete, edit, save, cancel
  - upload, download, share, copy, print

Navigation Icons:
  - back, forward, up, down
  - menu, more, expand, collapse

Status Icons:
  - success, warning, error, info
  - loading, empty, offline

Medical Icons:
  - patient, doctor, record, report
  - appointment, exam, treatment, medication
```

### 8. Avatar 头像组件

#### Figma组件设置
**组件名称**: `atom/avatar`

**属性 (Properties)**:
```yaml
type (Variant):
  - image (默认)
  - initials
  - icon

size (Variant):
  - xs (24px)
  - sm (32px)
  - md (40px) (默认)
  - lg (48px)
  - xl (64px)

status (Boolean): false
```

**状态指示器**:
```yaml
Online: 绿色圆点
Busy: 红色圆点
Away: 黄色圆点
Offline: 灰色圆点
位置: 右下角
大小: 头像尺寸的 1/4
```

### 9. Progress 进度条组件

#### Figma组件设置
**组件名称**: `atom/progress`

**属性 (Properties)**:
```yaml
type (Variant):
  - linear (默认)
  - circular

variant (Variant):
  - primary
  - success
  - warning
  - error

value (Number): 50 (0-100)
indeterminate (Boolean): false
```

**尺寸规格**:
```yaml
Linear:
  height: 4px
  border-radius: 2px
  width: 100%

Circular:
  diameter: 40px
  stroke-width: 4px
```

### 10. Loading 加载指示器组件

#### Figma组件设置
**组件名称**: `atom/loading`

**属性 (Properties)**:
```yaml
type (Variant):
  - spinner (默认)
  - dots
  - pulse

size (Variant):
  - sm (16px)
  - md (24px) (默认)
  - lg (32px)

color (Variant):
  - primary
  - secondary
  - white
```

### 11-20. 其他原子组件

**11. Divider 分割线**:
```yaml
orientation: horizontal, vertical
variant: solid, dashed, dotted
color: primary, secondary, tertiary
```

**12. Tag 标签**:
```yaml
variant: primary, secondary, outline, filled
size: small, medium
closable: Boolean
color: 8种颜色变体
```

**13. Skeleton 骨架屏**:
```yaml
type: text, circle, rectangle, custom
animation: wave, pulse, none
```

**14. Empty 空状态**:
```yaml
type: no-data, no-result, error, offline
size: small, medium, large
has-action: Boolean
```

**15. Tooltip 工具提示**:
```yaml
placement: top, bottom, left, right
variant: dark, light
size: small, medium
```

**16. Link 链接**:
```yaml
variant: primary, secondary, external
state: default, hover, visited, disabled
underline: Boolean
```

**17. Text 文本**:
```yaml
variant: h1, h2, h3, h4, body1, body2, caption
weight: light, normal, medium, semibold, bold
color: primary, secondary, tertiary, disabled
```

**18. Image 图片**:
```yaml
aspect-ratio: 1:1, 4:3, 16:9, custom
object-fit: cover, contain, fill
loading: lazy, eager
placeholder: Boolean
```

**19. Slider 滑块**:
```yaml
type: single, range
orientation: horizontal, vertical
size: small, medium, large
marks: Boolean
```

**20. Rating 评分**:
```yaml
max-value: 5 (默认), 10
allow-half: Boolean
readonly: Boolean
size: small, medium, large
```

## 分子组件设计 (15个)

### 1. Form Group 表单组

#### Figma组件设置
**组件名称**: `molecule/form-group`

**属性 (Properties)**:
```yaml
input-type (Instance Swap): input components
has-label (Boolean): true
label-position (Variant): top, left
has-help-text (Boolean): false
has-error (Boolean): false
required (Boolean): false
```

**布局结构**:
```yaml
Label:
  font-size: 12px
  font-weight: 500
  color: {color.text.primary}
  margin-bottom: 4px

Input:
  width: 100%
  margin-bottom: 4px

Help Text:
  font-size: 10px
  color: {color.text.tertiary}

Error Message:
  font-size: 10px
  color: {color.error}
  icon: error-icon
```

### 2. Search Bar 搜索栏

#### Figma组件设置
**组件名称**: `molecule/search-bar`

**属性 (Properties)**:
```yaml
variant (Variant):
  - default (默认)
  - outlined
  - filled

size (Variant):
  - medium (默认)
  - large

has-suggestions (Boolean): false
has-filters (Boolean): false
```

**功能元素**:
```yaml
搜索图标: 左侧 16px
输入区域: 中间自适应
清除按钮: 右侧 (有内容时显示)
过滤按钮: 右侧 (可选)
建议列表: 下方展开
```

### 3-15. 其他分子组件

**3. Alert Message**: 图标 + 内容 + 关闭按钮
**4. Navigation Item**: 图标 + 文本 + 状态指示
**5. Card Header**: 标题 + 副标题 + 操作按钮
**6. List Item**: 前置内容 + 主内容 + 后置内容
**7. Dropdown Menu**: 触发器 + 下拉选项列表
**8. Pagination**: 页码按钮 + 跳转输入
**9. Breadcrumb**: 路径链接 + 分隔符
**10. Steps**: 步骤节点 + 连接线 + 状态
**11. Upload**: 上传区域 + 文件列表 + 进度
**12. Date Picker**: 输入框 + 日历弹窗
**13. Time Picker**: 输入框 + 时间选择器
**14. Color Picker**: 颜色预览 + 调色盘
**15. Notification**: 图标 + 内容 + 时间 + 操作

## 有机组件设计 (12个)

### 1. Header 页头组件

#### Figma组件设置
**组件名称**: `organism/header`

**属性 (Properties)**:
```yaml
type (Variant):
  - main-header
  - page-header

has-back-button (Boolean): false
has-search (Boolean): false
has-actions (Boolean): true
```

**布局结构**:
```yaml
Main Header:
  height: 44px + safe-area
  padding: 12px 16px

  左区域: logo + 返回按钮
  中区域: 标题
  右区域: 搜索 + 设置 + 更多

Page Header:
  height: 56px
  padding: 16px

  标题区域: 主标题 + 副标题
  操作区域: 功能按钮组
```

### 2. Navigation 导航组件

#### Tab Bar 标签栏
```yaml
组件名称: organism/tab-bar
高度: 50px + safe-area
项目数量: 3-5个
图标大小: 20px
文字大小: 10px
```

#### Side Menu 侧边菜单
```yaml
组件名称: organism/side-menu
宽度: 280px
菜单项高度: 48px
分组间距: 16px
```

### 3-12. 其他有机组件

**3. Footer**: 版权信息 + 链接组
**4. Sidebar**: 导航菜单 + 用户信息
**5. Patient Card**: 头像 + 信息 + 状态 + 操作
**6. Form**: 表单组 + 操作按钮
**7. Table**: 表头 + 数据行 + 分页
**8. Calendar**: 月视图 + 日期选择
**9. Chart**: 图表容器 + 数据可视化
**10. Modal**: 遮罩 + 对话框 + 操作
**11. Drawer**: 侧滑容器 + 内容区域
**12. Dashboard Card**: 指标展示 + 图表 + 操作

## Figma 实施计划

### Phase 1: 基础设置 (2天)
1. 创建文件结构和页面
2. 设置 Design Tokens Variables
3. 建立颜色、字体、间距系统
4. 配置样式和效果

### Phase 2: 原子组件 (5天)
1. 创建前10个原子组件 (3天)
2. 创建后10个原子组件 (2天)
3. 配置组件属性和变体
4. 测试组件功能

### Phase 3: 分子组件 (4天)
1. 基于原子组件创建分子组件
2. 配置组件交互和状态
3. 建立组件间的依赖关系
4. 验证组合效果

### Phase 4: 有机组件 (5天)
1. 创建页面级组件
2. 整合所有子组件
3. 优化布局和交互
4. 完善响应式设计

### Phase 5: 验证和文档 (2天)
1. 组件库完整性检查
2. 使用场景验证
3. 编写使用文档
4. 团队培训准备

## 质量检查清单

### 组件完整性
- [ ] 所有组件使用 Design Tokens
- [ ] 所有变体状态完整
- [ ] 组件命名规范统一
- [ ] 属性配置正确

### 视觉一致性
- [ ] 颜色使用符合规范
- [ ] 间距遵循 8px 网格
- [ ] 字体层级清晰
- [ ] 圆角和阴影统一

### 交互可用性
- [ ] 触摸目标满足最小尺寸
- [ ] 状态变化清晰明确
- [ ] 反馈及时准确
- [ ] 无障碍性合规

### 技术规范
- [ ] 组件结构合理
- [ ] 属性类型正确
- [ ] 实例替换可用
- [ ] 自动布局有效

---

**文档版本**: 1.0
**创建日期**: 2024年12月
**最后更新**: 2024年12月
**负责人**: UI/UX设计团队