# 圆角令牌使用指南

## 概述

本文档定义了设计系统中圆角令牌的使用规范和最佳实践，确保UI元素在不同场景下保持一致的视觉风格。

圆角令牌定义在 `design-tokens.json` 的 `radius` 部分，通过 `npm run tokens:generate` 生成为 CSS 变量。

## 圆角体系

### 令牌定义

```json
{
  "radius": {
    "none": "0",
    "sm": "8rpx",
    "base": "12rpx",
    "md": "16rpx",
    "lg": "20rpx",
    "xl": "24rpx",
    "xxl": "32rpx",
    "full": "9999rpx"
  }
}
```

### CSS 变量引用

```css
/* 在 WXSS 中使用 */
.my-element {
  border-radius: var(--radius-base);
}
```

## 使用场景指南

### `--radius-none` (0)

**使用场景**：

- 需要完全方正的元素
- 表格单元格
- 需要紧密贴合的边界

**示例**：

```css
.table-cell {
  border-radius: var(--radius-none);
}
```

**不建议用于**：

- 交互元素（按钮、输入框）
- 独立卡片容器

---

### `--radius-sm` (8rpx)

**使用场景**：

- 标签（Tag）和徽章（Badge）
- 小型装饰元素
- 状态指示器
- Toast 提示
- 小型图标容器

**示例**：

```css
.badge {
  border-radius: var(--radius-sm);
  padding: 4rpx 12rpx;
}

.status-indicator {
  border-radius: var(--radius-sm);
}
```

**组件应用**：

- PM-Badge（待开发）
- PM-Tag（待开发）
- 卡片状态条右下角：`border-radius: 0 0 var(--radius-sm) 0`

---

### `--radius-base` (12rpx)

**使用场景**：

- 按钮（所有尺寸）
- 输入框和表单元素
- 小型卡片
- 选择器和下拉菜单
- 弹出提示（Tooltip）

**示例**：

```css
.pm-button {
  border-radius: var(--radius-base);
}

.pm-input__control {
  border-radius: var(--radius-base);
}

.tooltip {
  border-radius: var(--radius-base);
}
```

**组件应用**：

- PM-Button（所有类型和尺寸）
- PM-Input（所有尺寸）
- PM-Select（待开发）
- PM-Tooltip（待开发）

**设计原则**：这是最常用的圆角尺寸，适用于大多数交互元素，提供良好的点击体验。

---

### `--radius-md` (16rpx)

**使用场景**：

- 标准卡片和面板
- 列表项容器
- 信息展示区块
- 中型模态框内容区

**示例**：

```css
.pm-card {
  border-radius: var(--radius-md);
}

.list-item {
  border-radius: var(--radius-md);
}

.info-panel {
  border-radius: var(--radius-md);
}
```

**组件应用**：

- PM-Card（所有变体）
- 患者列表项
- 数据展示面板

**设计原则**：适合内容较多的容器，圆角更加明显，视觉上更加友好。

---

### `--radius-lg` (20rpx)

**使用场景**：

- 大型容器
- 页面主要内容区
- 图片容器
- 特殊强调的区块

**示例**：

```css
.content-section {
  border-radius: var(--radius-lg);
}

.featured-card {
  border-radius: var(--radius-lg);
}

.image-container {
  border-radius: var(--radius-lg);
  overflow: hidden;
}
```

**使用建议**：

- 用于需要视觉层级区分的大型容器
- 配合 `overflow: hidden` 处理内部内容

---

### `--radius-xl` (24rpx)

**使用场景**：

- 弹窗（Modal）和对话框（Dialog）
- 抽屉（Drawer）容器
- 底部操作面板（Action Sheet）
- 全屏卡片的顶部圆角

**示例**：

```css
.modal-content {
  border-radius: var(--radius-xl);
}

.action-sheet {
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
}

.drawer {
  border-radius: 0 var(--radius-xl) var(--radius-xl) 0;
}
```

**组件应用**：

- 确认选择患者弹窗
- PM-Modal（待开发）
- PM-Dialog（待开发）
- PM-ActionSheet（待开发）

**设计原则**：较大的圆角营造更柔和的视觉体验，适合需要用户聚焦的重要界面。

---

### `--radius-xxl` (32rpx)

**使用场景**：

- 超大型容器
- 全屏模态的装饰性圆角
- 品牌特色元素
- 特殊的视觉设计

**示例**：

```css
.hero-section {
  border-radius: var(--radius-xxl);
}

.brand-card {
  border-radius: var(--radius-xxl);
}
```

**使用建议**：

- 谨慎使用，避免过度圆角
- 适合大屏设备或特殊设计需求

---

### `--radius-full` (9999rpx)

**使用场景**：

- 圆形元素（头像、图标按钮）
- 药丸形按钮（Pill Button）
- 圆形指示器和徽章
- 清除按钮等圆形交互元素

**示例**：

```css
.avatar {
  border-radius: var(--radius-full);
  width: 80rpx;
  height: 80rpx;
}

.pill-button {
  border-radius: var(--radius-full);
  padding: 12rpx 32rpx;
}

.pm-input__clear {
  border-radius: var(--radius-full);
  width: 32rpx;
  height: 32rpx;
}
```

**组件应用**：

- PM-Avatar（待开发）
- PM-Input 的清除按钮
- 圆形图标按钮

**重要提示**：使用 `9999rpx` 而不是 `50%`，因为 `50%` 在非正方形元素上会产生椭圆。

---

## 最佳实践

### 1. 优先使用令牌

❌ **不推荐**：

```css
.my-button {
  border-radius: 12rpx; /* 硬编码值 */
}
```

✅ **推荐**：

```css
.my-button {
  border-radius: var(--radius-base);
}
```

### 2. 保持一致性

同一类型的元素应使用相同的圆角尺寸：

```css
/* 所有按钮使用相同圆角 */
.pm-button {
  border-radius: var(--radius-base);
}

.pm-button--small,
.pm-button--large {
  border-radius: var(--radius-base); /* 不要因尺寸改变而改变圆角 */
}
```

### 3. 层级关系

容器的圆角应大于其内部元素：

```css
.card {
  border-radius: var(--radius-md); /* 16rpx */
}

.card__button {
  border-radius: var(--radius-base); /* 12rpx < 16rpx */
}
```

### 4. 组合使用

对于需要部分圆角的元素：

```css
/* 顶部圆角 */
.modal {
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
}

/* 左侧圆角 */
.drawer {
  border-radius: 0 var(--radius-xl) var(--radius-xl) 0;
}

/* 特定角圆角 */
.status-bar {
  border-radius: 0 0 var(--radius-sm) 0; /* 仅右下角 */
}
```

### 5. 配合 overflow

圆角容器内有内容时，添加 `overflow: hidden`：

```css
.image-card {
  border-radius: var(--radius-md);
  overflow: hidden; /* 防止内部内容溢出圆角 */
}
```

## 迁移指南

### 从硬编码值迁移

1. **识别现有圆角值**：

   ```bash
   # 搜索项目中的硬编码圆角
   grep -r "border-radius:" wx-project/
   ```

2. **映射到令牌**：
   - `8rpx` → `var(--radius-sm)`
   - `12rpx` → `var(--radius-base)`
   - `16rpx` → `var(--radius-md)`
   - `20rpx` → `var(--radius-lg)`
   - `24rpx` → `var(--radius-xl)`
   - `50%` 或 `999rpx` → `var(--radius-full)`

3. **批量替换**：

   ```css
   /* 替换前 */
   .my-element {
     border-radius: 12rpx;
   }

   /* 替换后 */
   .my-element {
     border-radius: var(--radius-base);
   }
   ```

### 验证迁移

运行 Stylelint 检查：

```bash
npm run lint:style
```

## 组件圆角参考

| 组件       | 圆角令牌        | 值      |
| ---------- | --------------- | ------- |
| PM-Button  | `--radius-base` | 12rpx   |
| PM-Input   | `--radius-base` | 12rpx   |
| PM-Card    | `--radius-md`   | 16rpx   |
| PM-Modal   | `--radius-xl`   | 24rpx   |
| PM-Badge   | `--radius-sm`   | 8rpx    |
| PM-Avatar  | `--radius-full` | 9999rpx |
| 清除按钮   | `--radius-full` | 9999rpx |
| 状态条装饰 | `--radius-sm`   | 8rpx    |

## 常见问题

### Q: 何时使用自定义圆角值？

A: 几乎不需要。如果确实需要特殊圆角，应该：

1. 考虑是否可以调整设计以使用现有令牌
2. 如果是通用需求，考虑添加新的令牌
3. 只有在极特殊情况下才使用自定义值，并添加注释说明原因

### Q: 按钮的不同尺寸需要不同圆角吗？

A: 不需要。所有尺寸的按钮都应使用 `var(--radius-base)`，保持一致性。

### Q: 圆角过大会影响性能吗？

A: 通常不会。现代浏览器和小程序运行时对圆角渲染做了优化。但建议：

- 避免不必要的复杂圆角组合
- 避免动画改变圆角大小（使用 transform 代替）

### Q: 如何处理图片圆角？

A: 使用容器包裹并应用圆角：

```css
.image-wrapper {
  border-radius: var(--radius-md);
  overflow: hidden;
}

.image-wrapper image {
  width: 100%;
  height: 100%;
  display: block;
}
```

## 更新日志

- **2025-09-30**: 初始版本，定义7个圆角层级
- **2025-09-30**: 更新令牌值，优化圆角体系（调整 base 从 16rpx 到 12rpx）

## 相关文档

- [设计令牌规范](./design-tokens-spec.md)
- [组件库文档](../dev-environment/component-library.md)
- [样式迁移指南](./token-migration-summary.md)
