# Figma Design Tokens 实施指南

## 概述

本文档指导设计团队在Figma中建立设计令牌库，确保设计与开发的一致性。

## Figma Variables 设置

### 颜色令牌 (Color Variables)

#### 1. 创建颜色集合

**主色调集合 (Primary Colors)**:

```
Collection: Primary Colors
├── primary/base: #2E86AB
├── primary/50: #E8F4F8
├── primary/100: #D1E9F1
├── primary/200: #A3D3E3
├── primary/300: #75BDD5
├── primary/400: #47A7C7
├── primary/500: #2E86AB (base)
├── primary/600: #256B89
├── primary/700: #1C5067
├── primary/800: #133545
└── primary/900: #0A1A23
```

**次要色调集合 (Secondary Colors)**:

```
Collection: Secondary Colors
├── secondary/base: #F24236
├── secondary/50: #FEF2F1
├── secondary/100: #FDE5E3
├── secondary/200: #FBCBC7
├── secondary/300: #F9B1AB
├── secondary/400: #F7978F
├── secondary/500: #F24236 (base)
├── secondary/600: #C2352B
├── secondary/700: #912820
├── secondary/800: #611A15
└── secondary/900: #300D0A
```

**功能色彩集合 (Functional Colors)**:

```
Collection: Status Colors
├── success: #52C41A
├── warning: #FAAD14
├── error: #FF4D4F
├── info: #1890FF
```

**语义色彩集合 (Semantic Colors)**:

```
Collection: Text Colors
├── text/primary: #262626
├── text/secondary: #595959
├── text/tertiary: #8C8C8C
├── text/disabled: #BFBFBF

Collection: Background Colors
├── bg/primary: #FFFFFF
├── bg/secondary: #FAFAFA
├── bg/tertiary: #F5F5F5

Collection: Border Colors
├── border/primary: #D9D9D9
├── border/secondary: #F0F0F0
├── border/tertiary: #FAFAFA
```

### 字体令牌 (Typography Variables)

#### 字体大小集合 (Font Size)

```
Collection: Font Sizes
├── text/xs: 10
├── text/sm: 12
├── text/base: 14
├── text/md: 16
├── text/lg: 18
├── text/xl: 22
├── text/2xl: 28
└── text/3xl: 32
```

#### 字体重量集合 (Font Weight)

```
Collection: Font Weights
├── font/light: 300
├── font/normal: 400
├── font/medium: 500
├── font/semibold: 600
└── font/bold: 700
```

### 间距令牌 (Spacing Variables)

```
Collection: Spacing
├── space/0: 0
├── space/1: 4
├── space/2: 8
├── space/3: 12
├── space/4: 16
├── space/5: 20
├── space/6: 24
├── space/8: 32
├── space/10: 40
├── space/12: 48
└── space/16: 64
```

### 圆角令牌 (Border Radius Variables)

```
Collection: Border Radius
├── radius/none: 0
├── radius/sm: 4
├── radius/base: 8
├── radius/md: 12
├── radius/lg: 16
├── radius/xl: 20
└── radius/full: 999
```

## Variable Modes 设置

### 主题模式配置

**Light Mode (Default)**:

- 所有颜色变量使用默认值
- 主要用于日间使用场景

**Dark Mode (Future)**:

- 为后续暗色主题预留
- 当前阶段可以先创建模式，使用相同值

### 响应式模式配置

**Mobile (Default)**:

- 字体大小使用基础值
- 间距使用标准值

**Desktop**:

- 字体大小可以适当增大
- 间距可以相应调整

## Figma 组件库结构

### 文件组织架构

```
📁 患者档案管理系统设计系统/
├── 📄 🎨 Design Tokens
├── 📄 📚 Component Library
├── 📄 🖼️ Templates & Layouts
├── 📄 🎯 Icons & Assets
└── 📄 📖 Documentation
```

### 组件库分类

#### 基础组件 (Foundations)

```
📁 Foundations/
├── Colors/
│   ├── Color Palette
│   ├── Color Usage Examples
│   └── Accessibility Checker
├── Typography/
│   ├── Text Styles
│   ├── Heading Hierarchy
│   └── Text Examples
├── Spacing/
│   ├── Spacing Scale
│   └── Layout Grid
└── Shadows/
    ├── Shadow Elevation
    └── Shadow Examples
```

#### 原子组件 (Atoms)

```
📁 Atoms/
├── Button/
│   ├── Primary Button
│   ├── Secondary Button
│   ├── Outline Button
│   └── Text Button
├── Input/
│   ├── Text Input
│   ├── Password Input
│   ├── Search Input
│   └── Textarea
├── Form Elements/
│   ├── Checkbox
│   ├── Radio Button
│   ├── Switch
│   └── Slider
├── Icons/
│   ├── System Icons
│   ├── Navigation Icons
│   └── Status Icons
└── Badge/
    ├── Status Badge
    ├── Count Badge
    └── Label Badge
```

#### 分子组件 (Molecules)

```
📁 Molecules/
├── Form Group/
│   ├── Input with Label
│   ├── Input with Error
│   └── Input with Help Text
├── Search Bar/
├── Navigation Item/
├── Card Header/
├── Alert Message/
└── Loading Spinner/
```

#### 有机组件 (Organisms)

```
📁 Organisms/
├── Header/
│   ├── Main Header
│   └── Page Header
├── Navigation/
│   ├── Tab Bar
│   ├── Side Menu
│   └── Breadcrumb
├── Forms/
│   ├── Login Form
│   ├── Patient Info Form
│   └── Search Form
├── Cards/
│   ├── Patient Card
│   ├── Info Card
│   └── Action Card
└── Lists/
    ├── Patient List
    ├── Action List
    └── Menu List
```

## 变量命名规范

### Figma Variable 命名格式

```
{category}/{property}/{modifier}
```

**示例**:

- `color/primary/base`
- `color/text/primary`
- `space/padding/base`
- `typography/size/base`

### 组件命名规范

```
{type}/{name}/{variant}
```

**示例**:

- `atom/button/primary`
- `molecule/input-group/error`
- `organism/patient-card/summary`

## Tokens 同步流程

### 设计到开发同步

1. **Variables 导出**:
   - 使用 Figma Variables 导出插件
   - 生成 JSON 格式的 tokens 文件
   - 确保命名与 CSS custom properties 一致

2. **代码同步**:
   - 将导出的 JSON 合并至仓库根目录的 `design-tokens.json`
   - 运行 `npm run tokens:generate`，自动生成 `miniprogram/styles/generated/tokens.{wxss,js}`
   - 页面/组件通过 `@import "../../styles/generated/tokens.wxss"`、`foundation.wxss`、`utilities.wxss` 接入变量
   - 禁止手动修改 legacy `styles/tokens.wxss`

3. **质量检查**:
   - 对比设计稿与实现效果
   - 确保颜色、间距、字体等完全一致
   - 记录任何差异并及时修正

### 版本管理

1. **设计版本控制**:
   - 使用 Figma 版本历史
   - 重要变更打标签
   - 记录变更日志

2. **文档更新**:
   - 同步更新设计规范文档
   - 更新 tokens 规范
   - 通知开发团队变更

## 质量保证

### 设计一致性检查

1. **颜色使用验证**:
   - 所有颜色必须使用 Variables
   - 禁止硬编码颜色值
   - 定期审查颜色使用情况

2. **间距标准化**:
   - 所有间距使用定义的 spacing tokens
   - 组件内外边距遵循 8px 网格
   - 统一的布局节奏

3. **字体规范化**:
   - 所有文本使用定义的 text styles
   - 保持字体层级清晰
   - 确保可读性标准

### 无障碍性检查

1. **颜色对比度**:
   - 所有文本颜色组合符合 WCAG 2.1 AA 标准
   - 使用 Figma 无障碍插件检查
   - 记录对比度数值

2. **触摸目标大小**:
   - 最小触摸目标 44px (88rpx)
   - 交互元素间距充足
   - 适合手指操作

## 实施步骤

### Phase 1: 建立基础 (1周)

1. 创建 Variables Collections
2. 设置所有基础 tokens
3. 配置 modes (light/mobile)
4. 创建基础文档

### Phase 2: 原子组件 (2周)

1. 创建所有原子组件
2. 应用 variables 到组件
3. 创建组件变体
4. 建立使用示例

### Phase 3: 复合组件 (2周)

1. 构建分子组件
2. 组合有机组件
3. 创建页面模板
4. 完善交互规范

### Phase 4: 验证优化 (1周)

1. 全面质量检查
2. 无障碍性测试
3. 开发团队协作验证
4. 文档完善

## 维护指南

### 日常维护

- 每周检查组件使用情况
- 及时更新过时的设计
- 收集团队反馈并改进

### 版本升级

- 主要变更需要版本标记
- 保持向后兼容性
- 提供迁移指南

### 团队协作

- 定期设计评审会议
- 开发设计同步会议
- 持续改进工作流程

---

**文档版本**: 1.0
**创建日期**: 2024年12月
**最后更新**: 2024年12月
**负责人**: 设计系统团队
