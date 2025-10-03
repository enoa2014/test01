# 设计令牌命名规范

## 概述

本文档定义了公益小家患者档案管理系统设计令牌的命名规范和管理规则，确保设计系统的一致性和可维护性。

设计令牌的唯一来源（Single Source of Truth）位于 `design-tokens.json`，通过 `scripts/generate-tokens.js` 转换为：

- `miniprogram/styles/generated/tokens.wxss`（运行时注入 `.theme-root` / `page` 自定义属性）
- `miniprogram/styles/generated/tokens.js`（逻辑层读取）

请在更新令牌后执行：

```bash
npm run tokens:generate
```

命令会自动写入上述产物，禁止直接在 WXSS/JS 文件中手工修改变量定义。

> ℹ️ 圆角相关的命名、适用场景与示例均已整理在 [《圆角令牌使用指南》](./radius-usage-guide.md) 中。调整 `radius` 系列令牌前请先对照该文档，确保全局与组件级圆角保持一致。

## 命名原则

### 1. 层级结构

设计令牌采用三层架构：

```
Global Tokens (全局令牌)
├── Semantic Tokens (语义令牌)
└── Component Tokens (组件令牌)
```

### 2. 命名格式

```
--{category}-{property}-{modifier}
```

**示例**：

- `--color-primary` (基础令牌)
- `--color-text-primary` (语义令牌)
- `--button-primary-bg` (组件令牌)

## 相关文档

- [圆角令牌使用指南](./radius-usage-guide.md) - 详细的圆角使用规范和最佳实践

## 令牌分类

### 色彩令牌 (Color Tokens)

#### 全局色彩

```jsonc
// design-tokens.json → colors
{
  "primary": "#2E86AB", // 温暖蓝色 - 专业信赖
  "secondary": "#F24236", // 温馨橙色 - 关爱温暖
  "success": "#52C41A", // 成功绿
  "warning": "#FAAD14", // 警告黄
  "danger": "#FF4D4F", // 错误红
  "info": "#1890FF", // 信息蓝
}
```

转换后在 WXSS 中可通过 `var(--color-primary)` 等变量访问。

#### 语义色彩

```jsonc
// design-tokens.json → colors（节选）
{
  "textPrimary": "#262626",
  "textSecondary": "#595959",
  "textTertiary": "#8C8C8C",
  "textDisabled": "#BFBFBF",
  "bgPrimary": "#FFFFFF",
  "bgSecondary": "#FAFAFA",
  "bgTertiary": "#F5F5F5",
  "borderPrimary": "#D9D9D9",
  "borderSecondary": "#F0F0F0",
  "borderTertiary": "#FAFAFA",
}
```

### 字体令牌 (Typography Tokens)

#### 字体大小

```css
--text-xs: 20rpx; /* 10px - 极小文本 */
--text-sm: 24rpx; /* 12px - 小文本 */
--text-base: 28rpx; /* 14px - 基础文本 */
--text-md: 32rpx; /* 16px - 中等文本 */
--text-lg: 36rpx; /* 18px - 大文本 */
--text-xl: 44rpx; /* 22px - 特大文本 */
--text-2xl: 56rpx; /* 28px - 超大文本 */
--text-3xl: 64rpx; /* 32px - 巨大文本 */
```

#### 字体重量

```css
--font-light: 300; /* 细体 */
--font-normal: 400; /* 常规 */
--font-medium: 500; /* 中等 */
--font-semibold: 600; /* 半粗体 */
--font-bold: 700; /* 粗体 */
```

### 间距令牌 (Spacing Tokens)

```css
--space-0: 0;
--space-1: 8rpx; /* 4px */
--space-2: 16rpx; /* 8px */
--space-3: 24rpx; /* 12px */
--space-4: 32rpx; /* 16px */
--space-5: 40rpx; /* 20px */
--space-6: 48rpx; /* 24px */
--space-8: 64rpx; /* 32px */
--space-10: 80rpx; /* 40px */
--space-12: 96rpx; /* 48px */
--space-16: 128rpx; /* 64px */
```

### 圆角令牌 (Border Radius Tokens)

> 📘 详细使用指南请参考：[圆角令牌使用指南](./radius-usage-guide.md)

```css
--radius-none: 0; /* 无圆角 */
--radius-sm: 8rpx; /* 4px - 标签、徽章 */
--radius-base: 12rpx; /* 6px - 按钮、输入框（最常用）⭐ */
--radius-md: 16rpx; /* 8px - 卡片、面板 */
--radius-lg: 20rpx; /* 10px - 大型容器 */
--radius-xl: 24rpx; /* 12px - 弹窗、模态框 */
--radius-xxl: 32rpx; /* 16px - 超大容器 */
--radius-full: 9999rpx; /* 完全圆形（头像、图标按钮）*/
```

**使用场景快速参考**：

- `base`: 按钮、输入框、小型交互元素（日常最常用）
- `md`: 卡片、列表项、信息面板
- `xl`: 弹窗、对话框、抽屉
- `full`: 圆形元素（头像、圆形按钮、指示器）

### 阴影令牌 (Shadow Tokens)

````css
/* 灰度阴影 */
--shadow-none: none;
--shadow-xs: 0 2rpx 4rpx rgba(0, 0, 0, 0.05);
--shadow-sm: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
--shadow-base: 0 4rpx 16rpx rgba(0, 0, 0, 0.10);
--shadow-md: 0 8rpx 24rpx rgba(0, 0, 0, 0.12);
--shadow-lg: 0 16rpx 32rpx rgba(0, 0, 0, 0.15);
--shadow-xl: 0 24rpx 48rpx rgba(0, 0, 0, 0.18);
--shadow-floating: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);

/* 彩色阴影 */
--shadow-primary: 0 8rpx 32rpx rgba(46, 134, 171, 0.25);
--shadow-secondary: 0 8rpx 32rpx rgba(242, 66, 54, 0.25);
--shadow-success: 0 8rpx 32rpx rgba(82, 196, 26, 0.25);
--shadow-warning: 0 8rpx 32rpx rgba(250, 173, 20, 0.25);
--shadow-danger: 0 8rpx 32rpx rgba(255, 77, 79, 0.25);

/* 使用示例 */
/* 列表页悬浮按钮使用较柔和的浮层阴影 */
.fab button {
  box-shadow: var(--shadow-floating);
}

### 遮罩令牌 (Overlay Tokens)

```css
--overlay-dim: rgba(17, 24, 39, 0.45);
--overlay-modal: rgba(17, 24, 39, 0.5);
--overlay-strong: rgba(17, 24, 39, 0.6);
--overlay-inverse40: rgba(255, 255, 255, 0.4);
````

- `overlay-dim`：列表筛选等轻量浮层使用的背景遮罩。
- `overlay-modal`：模态确认、草稿恢复弹窗使用，满足 AA 无障碍对比度。
- `overlay-strong`：文本预览等需要更强聚焦的遮罩。
- `overlay-inverse40`：按钮加载动画等反向高亮元素。

**使用示例**

```css
.draft-modal {
  background-color: var(--overlay-modal);
}

.text-preview-mask {
  background: var(--overlay-strong);
}

.pm-button__spinner {
  border: 4rpx solid var(--overlay-inverse40);
}
```

### 背景效果令牌 (Background Tokens)

```css
--bg-info-soft: rgba(24, 144, 255, 0.08);
--bg-warning-soft: rgba(250, 173, 20, 0.15);
--bg-surface-translucent: rgba(255, 255, 255, 0.8);
```

这些令牌用于强调区块或轻量提示，避免重复写 `rgba()`。

**使用示例**

```css
.hint-section,
.intake-hint {
  background-color: var(--bg-info-soft);
}

.new-badge {
  background-color: var(--bg-warning-soft);
}

.loading-overlay {
  background-color: var(--bg-surface-translucent);
}
```

### 渐变令牌 (Gradient Tokens)

```css
--gradient-info-light: linear-gradient(145deg, rgba(24, 144, 255, 0.05), rgba(24, 144, 255, 0.1));
--gradient-info-light-hover: linear-gradient(
  145deg,
  rgba(24, 144, 255, 0.08),
  rgba(24, 144, 255, 0.12)
);
--gradient-success-light: linear-gradient(
  145deg,
  rgba(16, 185, 129, 0.05),
  rgba(16, 185, 129, 0.1)
);
--gradient-success-light-hover: linear-gradient(
  145deg,
  rgba(16, 185, 129, 0.08),
  rgba(16, 185, 129, 0.12)
);
```

配合按钮与排序控件的 hover/active 状态使用，保持动态反馈一致。

**使用示例**

```css
.sort-button.desc {
  background: var(--gradient-info-light);
}

.sort-button.desc:hover {
  background: var(--gradient-info-light-hover);
}

.sort-button.asc {
  background: var(--gradient-success-light);
}
```

```

## 组件令牌规范

### 组件命名格式
```

--{component}-{element}-{property}-{state}

````

**示例**：
```css
/* Button 组件 */
--button-primary-bg: var(--color-primary);
--button-primary-bg-hover: var(--color-primary-dark);
--button-primary-text: #FFFFFF;
--button-primary-border: var(--color-primary);

/* Input 组件 */
--input-bg: var(--color-bg-primary);
--input-border: var(--color-border-primary);
--input-border-focus: var(--color-primary);
--input-text: var(--color-text-primary);
````

## 状态管理

### 交互状态

- `default` - 默认状态
- `hover` - 悬停状态
- `active` - 激活状态
- `focus` - 聚焦状态
- `disabled` - 禁用状态
- `loading` - 加载状态

### 状态令牌示例

```css
/* 按钮状态 */
--button-primary-bg-default: var(--color-primary);
--button-primary-bg-hover: var(--color-primary-dark);
--button-primary-bg-active: var(--color-primary-dark);
--button-primary-bg-disabled: var(--color-text-disabled);
```

## 主题系统

### 明暗模式支持

```css
/* 默认主题 (亮色) */
:root {
  --theme-bg: var(--color-bg-primary);
  --theme-text: var(--color-text-primary);
}

/* 暗色主题 */
[data-theme='dark'] {
  --theme-bg: #1f1f1f;
  --theme-text: #ffffff;
}
```

## 文件组织

### 目录结构

```
miniprogram/styles/
├── generated/
│   ├── tokens.wxss          # 运行 `npm run tokens:generate` 自动生成
│   └── tokens.js            # 逻辑层使用的同步产物
├── foundation.wxss          # 全局排版与语义类
├── utilities.wxss           # 工具类（颜色/间距/布局等）
├── responsive.wxss          # 响应式断点辅助
└── legacy/                  # 历史文件，仅保留兼容（禁止新增内容）
    └── tokens.wxss
```

> 提示：所有设计令牌必须通过 `design-tokens.json → npm run tokens:generate` 流程更新，`legacy/tokens.wxss` 仅作为旧版本过渡引用，待迁移完成后可删除。

## 使用指南

### 1. 优先级原则

1. 使用语义令牌 (推荐)
2. 使用全局令牌
3. 避免硬编码值

### 2. 良好实践

```css
/* ✅ 推荐 */
.card {
  background-color: var(--color-bg-primary);
  border: 2rpx solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

/* ❌ 不推荐 */
.card {
  background-color: #ffffff;
  border: 2rpx solid #d9d9d9;
  border-radius: 32rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
}
```

### 3. 扩展令牌

添加新令牌时，遵循现有命名规范：

```css
/* 新增间距令牌 */
--space-14: 112rpx; /* 56px */
--space-20: 160rpx; /* 80px */

/* 新增色彩令牌 */
--color-purple: #722ed1;
--color-purple-light: #9254de;
--color-purple-dark: #531dab;
```

## 验证和测试

### 令牌覆盖率检查

- 确保所有组件使用设计令牌
- 避免硬编码的CSS值
- 定期审查令牌使用情况

### 一致性验证

- 检查相同语义的令牌值是否一致
- 验证颜色对比度符合无障碍标准
- 确保间距系统的数学一致性

## 维护规范

### 版本管理

- 令牌更改需要版本号标记
- 重大更改需要迁移指南
- 保持向后兼容性

### 文档更新

- 新增令牌需要更新本文档
- 记录令牌的使用场景和限制
- 提供使用示例

---

**文档版本**: 1.0
**创建日期**: 2024年12月
**最后更新**: 2024年12月
**负责人**: 设计系统团队
