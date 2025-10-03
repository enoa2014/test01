# 基础组件设计规范

## 概述

本文档定义了公益小家患者档案管理系统中所有基础UI组件的设计规范，确保一致性、可用性和无障碍性。

## 设计原则

### 核心原则

1. **一致性**: 所有组件遵循统一的视觉语言和交互模式
2. **可用性**: 优先考虑用户体验和操作便捷性
3. **无障碍性**: 符合WCAG 2.1 AA标准
4. **响应式**: 适配不同屏幕尺寸和设备
5. **可维护性**: 模块化设计，便于维护和扩展

### 医疗应用特点

- **专业性**: 界面简洁专业，避免过度装饰
- **可读性**: 文字清晰，对比度充足
- **安全性**: 重要操作有明确提示和确认
- **效率性**: 减少操作步骤，提高工作效率

## 组件分类体系

### Atomic Design 层级

```
Atoms (原子) → Molecules (分子) → Organisms (有机体) → Templates (模板) → Pages (页面)
```

#### 原子组件 (Atoms)

最基本的UI元素，不可再分割

#### 分子组件 (Molecules)

由原子组件组合而成的简单功能单元

#### 有机组件 (Organisms)

由分子和原子组件组成的复杂界面区域

#### 模板组件 (Templates)

定义页面结构的线框布局

#### 页面组件 (Pages)

具体内容的模板实例

## 原子组件规范

### 1. Button 按钮

#### 设计规范

```yaml
最小尺寸: 88rpx × 88rpx (44px 触摸目标)
圆角: var(--radius-lg) 16px
字体: var(--font-medium) 500
内边距: var(--space-3) var(--space-6) (12px 24px)
行高: 1.2
最小宽度: 128rpx (64px)
```

#### 变体定义

**Primary Button (主按钮)**:

```css
background: var(--color-primary)
color: #FFFFFF
border: none
hover: var(--color-primary-dark)
disabled: var(--color-text-disabled)
```

**Secondary Button (次按钮)**:

```css
background: transparent
color: var(--color-primary)
border: 2rpx solid var(--color-primary)
hover: var(--color-primary) background, #FFFFFF color
disabled: var(--color-text-disabled)
```

**Outline Button (轮廓按钮)**:

```css
background: transparent
color: var(--color-text-primary)
border: 2rpx solid var(--color-border-primary)
hover: var(--color-bg-secondary) background
disabled: var(--color-text-disabled)
```

**Text Button (文本按钮)**:

```css
background: transparent
color: var(--color-primary)
border: none
padding: var(--space-2) var(--space-3)
hover: var(--color-primary-light)
disabled: var(--color-text-disabled)
```

#### 尺寸规格

- **Large**: 48rpx height, 16px font
- **Medium**: 40rpx height, 14px font (默认)
- **Small**: 32rpx height, 12px font

#### 状态设计

- **Default**: 默认状态
- **Hover**: 悬停状态 (PC端)
- **Active**: 点击状态
- **Focus**: 聚焦状态
- **Loading**: 加载状态 (显示加载图标)
- **Disabled**: 禁用状态

### 2. Input 输入框

#### 设计规范

```yaml
高度: 88rpx (44px 最小触摸目标)
圆角: var(--radius-base) 8px
内边距: var(--space-3) var(--space-4) (12px 16px)
边框: 2rpx solid var(--color-border-primary)
字体: var(--text-base) 14px
行高: 1.5
```

#### 变体定义

**Text Input (文本输入)**:

```css
type: text
placeholder: var(--color-text-tertiary)
focus: border-color var(--color-primary)
error: border-color var(--color-error)
```

**Password Input (密码输入)**:

```css
type: password
显示切换按钮: 眼睛图标
安全性指示: 密码强度提示
```

**Search Input (搜索输入)**:

```css
前置图标: 搜索图标
清除按钮: X图标 (有内容时显示)
自动完成: 支持搜索建议
```

**Textarea (多行文本)**:

```css
最小高度: 176rpx (88px)
可调整: 垂直方向
最大行数: 10行
字数统计: 可选显示
```

#### 状态设计

- **Default**: 默认状态
- **Focus**: 聚焦状态 (边框高亮)
- **Filled**: 已填写状态
- **Error**: 错误状态 (红色边框)
- **Success**: 成功状态 (绿色边框)
- **Disabled**: 禁用状态

### 3. Form Elements 表单元素

#### Checkbox 复选框

```yaml
尺寸: 32rpx × 32rpx (16px)
圆角: var(--radius-sm) 4px
选中颜色: var(--color-primary)
边框: 2rpx solid var(--color-border-primary)
内边距: 4rpx
标签间距: var(--space-2) 8px
```

#### Radio Button 单选按钮

```yaml
尺寸: 32rpx × 32rpx (16px)
形状: 圆形
选中颜色: var(--color-primary)
边框: 2rpx solid var(--color-border-primary)
内圆尺寸: 12rpx × 12rpx (6px)
标签间距: var(--space-2) 8px
```

#### Switch 开关

```yaml
宽度: 88rpx (44px)
高度: 48rpx (24px)
圆角: 24rpx (12px)
滑块尺寸: 40rpx × 40rpx (20px)
开启颜色: var(--color-primary)
关闭颜色: var(--color-border-primary)
动画: 200ms ease-in-out
```

#### Slider 滑块

```yaml
轨道高度: 8rpx (4px)
滑块尺寸: 40rpx × 40rpx (20px)
轨道颜色: var(--color-border-primary)
活动颜色: var(--color-primary)
圆角: var(--radius-full)
触摸区域: 88rpx × 88rpx (44px)
```

### 4. Badge 徽章

#### 设计规范

```yaml
最小高度: 32rpx (16px)
内边距: var(--space-1) var(--space-2) (4px 8px)
圆角: var(--radius-full)
字体: var(--text-xs) 10px
字重: var(--font-medium) 500
最小宽度: 32rpx (16px)
```

#### 变体定义

**Status Badge (状态徽章)**:

```css
Success: background var(--color-success), color #FFFFFF
Warning: background var(--color-warning), color #FFFFFF
Error: background var(--color-error), color #FFFFFF
Info: background var(--color-info), color #FFFFFF
```

**Count Badge (计数徽章)**:

```css
background: var(--color-error)
color: #FFFFFF
形状: 圆形 (数字 < 10) 或 圆角矩形
最大显示: 99+ (超过99显示99+)
```

**Label Badge (标签徽章)**:

```css
background: var(--color-bg-tertiary)
color: var(--color-text-secondary)
border: 1rpx solid var(--color-border-secondary)
```

### 5. Icon 图标

#### 设计规范

```yaml
标准尺寸: 32rpx × 32rpx (16px)
大尺寸: 48rpx × 48rpx (24px)
小尺寸: 24rpx × 24rpx (12px)
线条粗细: 2rpx (1px)
圆角: 2rpx (1px)
网格: 24×24 pixel grid
风格: 线性图标
```

#### 图标分类

**系统图标**:

- 首页、设置、搜索、刷新、关闭
- 添加、删除、编辑、保存、取消
- 上传、下载、分享、复制、打印

**导航图标**:

- 返回、前进、上一页、下一页
- 菜单、更多、展开、收起

**状态图标**:

- 成功、警告、错误、信息
- 加载、空状态、网络错误

**业务图标**:

- 患者、医生、病历、报告
- 预约、检查、治疗、药物

#### 使用规范

- 保持图标风格一致
- 使用语义化命名
- 提供无障碍标签
- 支持主题色彩变化

## 分子组件规范

### 1. Form Group 表单组

#### Input Group (输入组)

```yaml
组成: Label + Input + Helper Text / Error Message
标签位置: 上方，左对齐
标签字体: var(--text-sm) 12px, var(--font-medium)
输入框间距: var(--space-2) 8px
错误信息: var(--color-error), var(--text-xs) 10px
帮助文本: var(--color-text-tertiary), var(--text-xs) 10px
```

#### Select Group (选择组)

```yaml
组成: Label + Select + Dropdown Options
下拉箭头: 右侧 8px
选项高度: 88rpx (44px 触摸目标)
最大显示: 6个选项 (超出滚动)
选中状态: var(--color-primary) background
```

### 2. Search Bar 搜索栏

#### 设计规范

```yaml
高度: 88rpx (44px)
圆角: var(--radius-lg) 16px
内边距: var(--space-3) var(--space-4) (12px 16px)
背景: var(--color-bg-secondary)
边框: none (默认) 或 1rpx solid var(--color-border-secondary)
```

#### 功能特性

- 搜索图标前置
- 清除按钮后置 (有内容时)
- 历史搜索建议
- 热门搜索推荐
- 搜索结果高亮

### 3. Alert Message 警告信息

#### 设计规范

```yaml
最小高度: 88rpx (44px)
圆角: var(--radius-base) 8px
内边距: var(--space-4) (16px)
图标大小: 32rpx × 32rpx (16px)
图标间距: var(--space-3) 12px
```

#### 变体定义

**Success Alert**:

```css
background: rgba(82, 196, 26, 0.1)
border: 1rpx solid var(--color-success)
color: var(--color-success)
icon: check-circle
```

**Warning Alert**:

```css
background: rgba(250, 173, 20, 0.1)
border: 1rpx solid var(--color-warning)
color: var(--color-warning)
icon: warning-circle
```

**Error Alert**:

```css
background: rgba(255, 77, 79, 0.1)
border: 1rpx solid var(--color-error)
color: var(--color-error)
icon: close-circle
```

**Info Alert**:

```css
background: rgba(24, 144, 255, 0.1)
border: 1rpx solid var(--color-info)
color: var(--color-info)
icon: info-circle
```

## 有机组件规范

### 1. Header 页头

#### Main Header (主页头)

```yaml
高度: 88rpx (44px) + 安全区域
背景: var(--color-bg-primary)
边框: 1rpx solid var(--color-border-secondary) (底部)
内边距: var(--space-3) var(--space-4) (12px 16px)
阴影: var(--shadow-sm)
```

**布局结构**:

- 左侧: 返回按钮 (可选) + Logo/标题
- 中间: 页面标题
- 右侧: 功能按钮 (搜索、设置、更多)

#### Page Header (页面页头)

```yaml
高度: 112rpx (56px)
背景: var(--color-bg-primary)
内边距: var(--space-4) (16px)
```

**布局结构**:

- 标题: var(--text-lg) 18px, var(--font-semibold)
- 副标题: var(--text-sm) 12px, var(--color-text-secondary)
- 操作按钮: 右对齐

### 2. Navigation 导航

#### Tab Bar (标签栏)

```yaml
高度: 100rpx (50px) + 安全区域
背景: var(--color-bg-primary)
边框: 1rpx solid var(--color-border-secondary) (顶部)
项目数量: 3-5个
```

**Tab Item 规范**:

```yaml
最小触摸区域: 88rpx × 88rpx (44px)
图标大小: 40rpx × 40rpx (20px)
文字大小: var(--text-xs) 10px
间距: var(--space-1) 4px (图标与文字)
活动颜色: var(--color-primary)
非活动颜色: var(--color-text-tertiary)
```

#### Side Menu (侧边菜单)

```yaml
宽度: 560rpx (280px)
背景: var(--color-bg-primary)
阴影: var(--shadow-lg)
动画: 300ms ease-in-out
```

**Menu Item 规范**:

```yaml
高度: 96rpx (48px)
内边距: var(--space-3) var(--space-4) (12px 16px)
图标大小: 32rpx × 32rpx (16px)
图标间距: var(--space-3) 12px
hover: var(--color-bg-secondary)
active: var(--color-primary), 左侧 4rpx 边框
```

### 3. Card 卡片

#### Patient Card (患者卡片)

```yaml
圆角: var(--radius-lg) 16px
内边距: var(--space-4) (16px)
背景: var(--color-bg-primary)
边框: 1rpx solid var(--color-border-primary)
阴影: var(--shadow-sm)
hover: var(--shadow-md)
```

**内容结构**:

- 头像区域: 80rpx × 80rpx (40px), 圆形
- 信息区域: 姓名 + 基本信息
- 状态区域: 状态徽章
- 操作区域: 操作按钮

#### Info Card (信息卡片)

```yaml
最小高度: 176rpx (88px)
圆角: var(--radius-base) 8px
内边距: var(--space-4) (16px)
背景: var(--color-bg-primary)
边框: 1rpx solid var(--color-border-primary)
```

### 4. List 列表

#### Patient List (患者列表)

```yaml
项目高度: 144rpx (72px)
分割线: 1rpx solid var(--color-border-secondary)
内边距: var(--space-4) (16px)
hover: var(--color-bg-secondary)
active: var(--color-primary-light)
```

#### Action List (操作列表)

```yaml
项目高度: 88rpx (44px)
内边距: var(--space-3) var(--space-4) (12px 16px)
图标大小: 32rpx × 32rpx (16px)
图标间距: var(--space-3) 12px
```

## 响应式设计

### 断点系统

```yaml
xs: < 480rpx # 极小屏幕
sm: 480rpx # 小屏手机
md: 750rpx # 标准手机 (设计基准)
lg: 960rpx # 大屏手机
xl: 1200rpx # 平板竖屏
2xl: 1536rpx # 平板横屏
```

### 适配策略

- **移动优先**: 基于750rpx设计稿，向上适配
- **灵活布局**: 使用弹性布局和网格系统
- **比例缩放**: 关键尺寸按比例调整
- **内容优先**: 确保内容在所有尺寸下可读

## 无障碍性规范

### 颜色对比度

- **正常文本**: 对比度 ≥ 4.5:1
- **大文本**: 对比度 ≥ 3:1
- **图标**: 对比度 ≥ 3:1
- **状态指示**: 不仅依赖颜色

### 触摸目标

- **最小尺寸**: 88rpx × 88rpx (44px)
- **间距**: 相邻目标间距 ≥ 16rpx (8px)
- **反馈**: 提供视觉和触觉反馈

### 屏幕阅读器

- **语义化标签**: 使用正确的HTML标签
- **替代文本**: 图片和图标提供alt描述
- **标题层级**: 保持逻辑层级结构
- **焦点管理**: 合理的焦点顺序

### 键盘导航

- **焦点可见**: 明确的焦点指示器
- **逻辑顺序**: 符合阅读习惯的Tab顺序
- **快捷键**: 常用功能提供快捷键
- **跳转链接**: 提供跳转到主内容的链接

## 动画和交互

### 动画原则

- **有意义**: 动画服务于功能，不仅为装饰
- **自然**: 模拟真实世界的物理运动
- **快速**: 持续时间通常 < 300ms
- **可选**: 尊重用户的动画偏好设置

### 标准动画

```yaml
淡入淡出: 200ms ease-in-out
滑动: 300ms ease-out
弹性: 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275)
页面转场: 300ms ease-in-out
```

### 交互反馈

- **点击反馈**: 按下状态 + 轻微缩放
- **加载状态**: 进度指示器或骨架屏
- **成功反馈**: 绿色检查图标 + 短暂提示
- **错误反馈**: 红色警告 + 错误信息

## 性能优化

### 资源优化

- **图标**: 使用SVG或字体图标
- **图片**: WebP格式 + 多尺寸适配
- **颜色**: 使用CSS变量减少重复
- **动画**: 使用transform和opacity

### 加载策略

- **关键路径**: 优先加载首屏内容
- **懒加载**: 非关键资源延迟加载
- **预加载**: 预测用户行为，提前加载
- **缓存**: 合理使用浏览器缓存

## 组件清单

### 原子组件 (20个)

1. Button (按钮)
2. Input (输入框)
3. Textarea (多行文本)
4. Checkbox (复选框)
5. Radio (单选按钮)
6. Switch (开关)
7. Slider (滑块)
8. Badge (徽章)
9. Icon (图标)
10. Avatar (头像)
11. Divider (分割线)
12. Tag (标签)
13. Progress (进度条)
14. Loading (加载指示器)
15. Empty (空状态)
16. Skeleton (骨架屏)
17. Tooltip (工具提示)
18. Link (链接)
19. Text (文本)
20. Image (图片)

### 分子组件 (15个)

1. Form Group (表单组)
2. Search Bar (搜索栏)
3. Alert Message (警告信息)
4. Navigation Item (导航项)
5. Card Header (卡片头部)
6. List Item (列表项)
7. Dropdown Menu (下拉菜单)
8. Pagination (分页)
9. Breadcrumb (面包屑)
10. Steps (步骤条)
11. Rate (评分)
12. Upload (上传)
13. Date Picker (日期选择)
14. Time Picker (时间选择)
15. Color Picker (颜色选择)

### 有机组件 (12个)

1. Header (页头)
2. Footer (页脚)
3. Sidebar (侧边栏)
4. Navigation (导航栏)
5. Tab Bar (标签栏)
6. Patient Card (患者卡片)
7. Form (表单)
8. Table (表格)
9. Calendar (日历)
10. Chart (图表)
11. Modal (模态框)
12. Drawer (抽屉)

## 质量检查清单

### 设计一致性

- [ ] 所有颜色使用设计令牌
- [ ] 所有间距符合8px网格
- [ ] 所有圆角使用统一规范
- [ ] 所有阴影使用预定义值
- [ ] 所有字体使用文本样式

### 响应式检查

- [ ] 在所有断点下显示正常
- [ ] 触摸目标满足最小尺寸要求
- [ ] 内容在小屏幕下可读
- [ ] 交互元素间距充足

### 无障碍性检查

- [ ] 颜色对比度符合标准
- [ ] 所有交互元素可键盘访问
- [ ] 图片和图标有替代文本
- [ ] 表单标签正确关联

### 性能检查

- [ ] 组件加载时间 < 100ms
- [ ] 动画流畅，无卡顿
- [ ] 内存使用合理
- [ ] 兼容目标设备性能

---

**文档版本**: 1.0
**创建日期**: 2024年12月
**最后更新**: 2024年12月
**负责人**: UI/UX设计团队
