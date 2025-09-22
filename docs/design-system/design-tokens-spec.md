# 设计令牌命名规范

## 概述

本文档定义了公益小家患者档案管理系统设计令牌的命名规范和管理规则，确保设计系统的一致性和可维护性。

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

## 令牌分类

### 色彩令牌 (Color Tokens)

#### 全局色彩
```css
/* 主色调 */
--color-primary: #2E86AB;     /* 温暖蓝色 - 专业信赖 */
--color-secondary: #F24236;   /* 温馨橙色 - 关爱温暖 */

/* 功能色彩 */
--color-success: #52C41A;     /* 成功绿 */
--color-warning: #FAAD14;     /* 警告黄 */
--color-error: #FF4D4F;       /* 错误红 */
--color-info: #1890FF;        /* 信息蓝 */
```

#### 语义色彩
```css
/* 文本色彩 */
--color-text-primary: #262626;    /* 主要文本 */
--color-text-secondary: #595959;  /* 次要文本 */
--color-text-tertiary: #8C8C8C;   /* 辅助文本 */
--color-text-disabled: #BFBFBF;   /* 禁用文本 */

/* 背景色彩 */
--color-bg-primary: #FFFFFF;      /* 主要背景 */
--color-bg-secondary: #FAFAFA;    /* 次要背景 */
--color-bg-tertiary: #F5F5F5;     /* 辅助背景 */

/* 边框色彩 */
--color-border-primary: #D9D9D9;    /* 主要边框 */
--color-border-secondary: #F0F0F0;  /* 次要边框 */
--color-border-tertiary: #FAFAFA;   /* 辅助边框 */
```

### 字体令牌 (Typography Tokens)

#### 字体大小
```css
--text-xs: 20rpx;     /* 10px - 极小文本 */
--text-sm: 24rpx;     /* 12px - 小文本 */
--text-base: 28rpx;   /* 14px - 基础文本 */
--text-md: 32rpx;     /* 16px - 中等文本 */
--text-lg: 36rpx;     /* 18px - 大文本 */
--text-xl: 44rpx;     /* 22px - 特大文本 */
--text-2xl: 56rpx;    /* 28px - 超大文本 */
--text-3xl: 64rpx;    /* 32px - 巨大文本 */
```

#### 字体重量
```css
--font-light: 300;    /* 细体 */
--font-normal: 400;   /* 常规 */
--font-medium: 500;   /* 中等 */
--font-semibold: 600; /* 半粗体 */
--font-bold: 700;     /* 粗体 */
```

### 间距令牌 (Spacing Tokens)

```css
--space-0: 0;
--space-1: 8rpx;      /* 4px */
--space-2: 16rpx;     /* 8px */
--space-3: 24rpx;     /* 12px */
--space-4: 32rpx;     /* 16px */
--space-5: 40rpx;     /* 20px */
--space-6: 48rpx;     /* 24px */
--space-8: 64rpx;     /* 32px */
--space-10: 80rpx;    /* 40px */
--space-12: 96rpx;    /* 48px */
--space-16: 128rpx;   /* 64px */
```

### 圆角令牌 (Border Radius Tokens)

```css
--radius-none: 0;
--radius-sm: 8rpx;    /* 4px - 小圆角 */
--radius-base: 16rpx; /* 8px - 基础圆角 */
--radius-md: 24rpx;   /* 12px - 中等圆角 */
--radius-lg: 32rpx;   /* 16px - 大圆角 */
--radius-xl: 40rpx;   /* 20px - 特大圆角 */
--radius-full: 50%;   /* 完全圆形 */
```

### 阴影令牌 (Shadow Tokens)

```css
/* 灰度阴影 */
--shadow-none: none;
--shadow-xs: 0 2rpx 4rpx rgba(0, 0, 0, 0.05);
--shadow-sm: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
--shadow-base: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
--shadow-md: 0 8rpx 24rpx rgba(0, 0, 0, 0.12);
--shadow-lg: 0 16rpx 32rpx rgba(0, 0, 0, 0.15);
--shadow-xl: 0 24rpx 48rpx rgba(0, 0, 0, 0.18);
--shadow-2xl: 0 32rpx 64rpx rgba(0, 0, 0, 0.2);

/* 彩色阴影 */
--shadow-primary: 0 8rpx 32rpx rgba(46, 134, 171, 0.25);
--shadow-secondary: 0 8rpx 32rpx rgba(242, 66, 54, 0.25);
--shadow-success: 0 8rpx 32rpx rgba(82, 196, 26, 0.25);
--shadow-warning: 0 8rpx 32rpx rgba(250, 173, 20, 0.25);
--shadow-error: 0 8rpx 32rpx rgba(255, 77, 79, 0.25);
```

## 组件令牌规范

### 组件命名格式
```
--{component}-{element}-{property}-{state}
```

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
```

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
[data-theme="dark"] {
  --theme-bg: #1F1F1F;
  --theme-text: #FFFFFF;
}
```

## 文件组织

### 目录结构
```
miniprogram/styles/
├── tokens.wxss              # 主要设计令牌文件
├── components/               # 组件特定令牌
│   ├── button-tokens.wxss
│   ├── input-tokens.wxss
│   └── card-tokens.wxss
└── themes/                   # 主题变体
    ├── light-theme.wxss
    └── dark-theme.wxss
```

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
  background-color: #FFFFFF;
  border: 2rpx solid #D9D9D9;
  border-radius: 32rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
}
```

### 3. 扩展令牌
添加新令牌时，遵循现有命名规范：

```css
/* 新增间距令牌 */
--space-14: 112rpx;   /* 56px */
--space-20: 160rpx;   /* 80px */

/* 新增色彩令牌 */
--color-purple: #722ED1;
--color-purple-light: #9254DE;
--color-purple-dark: #531DAB;
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