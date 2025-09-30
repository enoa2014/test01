# 基础组件库架构指南

## 目标

- 建立与设计系统一致的基础组件库，为核心页面重构提供可复用构件。
- 规范组件目录、命名、依赖与主题扩展方式。
- 支持单元测试、示例预览与持续演进。

## 组件类型

| 层级     | 范例                                                     | 说明                     |
| -------- | -------------------------------------------------------- | ------------------------ |
| Base     | button, input, card, modal, badge, icon                  | 直接对应设计系统基础元件 |
| Form     | form, form-item, checkbox, radio, select, switch, slider | 表单交互相关组件         |
| Feedback | alert, toast, loading, skeleton, empty                   | 状态反馈与加载提示       |
| Layout   | container, grid, stack, divider, steps, collapse         | 布局与结构组件           |
| Data     | stat-card, timeline-item, tag, avatar                    | 数据展示与标签           |

## 目录结构（建议）

```
miniprogram/components
├─ base
│   ├─ button
│   │   ├─ button.wxml
│   │   ├─ button.wxss
│   │   ├─ button.js
│   │   ├─ button.json
│   │   └─ index.test.ts
│   ├─ input
│   └─ ...
├─ form
├─ feedback
├─ layout
├─ data
└─ index.ts              # 统一导出
```

### 命名规则

- 目录与文件使用小写连字符：`stat-card`。
- 组件注册名统一加前缀，避免与原生组件冲突，例如 `pm-stat-card`。
- 所有组件暴露 `class` 与 `style` 自定义入口，方便页面定制。

## 依赖与工具

- 推荐使用 TypeScript 编写逻辑（通过 `miniprogramRoot` 支持）。
- 公共逻辑与常量放置于 `miniprogram/utils`，避免重复实现。
- 主题配色、间距统一由 `design-tokens.json` 驱动，通过 `npm run tokens:generate` 生成的 `miniprogram/styles/generated/tokens.wxss` 及基础样式文件提供，禁止硬编码。
- 若需第三方库，优先选择轻量包并评估微信小程序兼容性。

## 组件开发约定

1. 属性定义

   ```json
   {
     "component": true,
     "usingComponents": {}
   }
   ```

   - 在 JS/TS 中使用 `properties` 定义属性，标注类型、默认值与 observer。
   - 对外暴露的事件统一使用 `bind:` 前缀，命名 `bind:click`, `bind:submit`。

2. 样式规范

- 引入全局变量：`@import "../../styles/generated/tokens.wxss"; @import "../../styles/foundation.wxss";`（按需追加 `utilities.wxss`）。
  - 避免使用 `px`，统一使用 `rpx`。
  - 使用 BEM 或 `pm-` 前缀，防止样式污染。

3. 交互状态
   - Button, Input 等组件需覆盖 `hover`, `active`, `disabled`, `loading`。
   - Modal、Toast 等需支持可控显示状态（受控模式）。

4. 文档与示例
   - 每个组件需提供 README（或在 Story 中补充）描述属性、事件、使用示例。
   - 结合组件展示页面（见 Component Lab 指南）。

## 导出与引用

- 在 `miniprogram/components/index.ts` 导出所有组件：
  ```ts
  export { default as Button } from './base/button';
  export { default as Input } from './base/input';
  // ...
  ```
- 页面内引用示例：
  ```json
  {
    "usingComponents": {
      "pm-button": "/components/base/button/index"
    }
  }
  ```

## 与设计系统对齐

- 颜色、字体、间距、阴影等必须引用 Story 001.1 中的设计令牌。
- 组件状态与尺寸需与设计规范保持一致（如按钮 `small/mid/large`）。
- 若设计更新，组件库需更新变量并产出 CHANGELOG。

## 版本管理

- 对组件库采用语义化版本（SemVer）。
- 通过 `docs/design-system/validation-checklist.md` 执行发布前核查。
- 发布流程：`feature/*` → `develop` → `release/*` → `main`，每次发布更新文档与变更记录。

## 路线图示例

1. Sprint 1：完成 Base + Form 组件（12 个），构建测试与组件实验室。
2. Sprint 2：补齐 Layout、Feedback 组件，完善主题切换与无障碍。
3. Sprint 3：结合页面需求扩展 Data 组件，与后端联调。
4. Sprint 4：沉淀高级模式（如复合组件）、性能优化与国际化预研。

## 维护建议

- 建立组件负责人制度，明确维护人。
- 阿米巴式收集需求：页面反馈 → 组件库 backlog → 冲刺规划。
- 每月例行 Review 组件 API 与使用情况，淘汰冗余实现。

## 示例实现

### 基础组件能力

- `pm-button`：支持 `type` (default/primary/secondary)、`size`、`block`、`ghost`、`loading`、`disabled` 以及自定义 slot。
- `pm-input`：除 `helper`、`error`、`prefix/ suffix` slot、`block` 布局与清除按钮外，已支持 `type="textarea"` 多行模式，可通过 `maxlength`、`textareaAutoHeight`、`showConfirmBar` 等属性控制字数上限、自动高度与工具栏展示。
- `pm-card`：新增 `header/footer` slot，可通过 `status` 控制语义颜色。

- `pm-button`、`pm-input`、`pm-card` 位于 `miniprogram/components/base/` 目录，作为 Story 001.3 的基础示例。
- 对应测试文件位于 `tests/unit/components/`，可作为新增组件单测的模板。
- Component Lab 页面默认加载上述组件，便于产品与设计快速预览。
