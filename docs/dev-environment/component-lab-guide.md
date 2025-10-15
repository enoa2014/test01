# 组件展示与演示环境指南（Component Lab）

## 背景

- 微信小程序环境无法直接使用 Storybook，但仍需要可视化展示与对外同步组件状态。
- 本指南提供“Component Lab”页面方案，用于组件演示、属性调试、无障碍/性能验证。

## 页面结构

> 当前实现位于 `wx-project/pages/component-lab/`，默认在开发环境中可用。发布前请根据下文“权限与安全”章节通过构建脚本移除或禁用。

```
wx-project/pages/component-lab
├─ index.wxml
├─ index.wxss
├─ index.js / index.ts
├─ index.json
└─ data/components.ts        # 组件元数据
```

### 页面功能

1. 左侧组件目录树（按 Base/Form/Layout 分类）。
2. 中间预览区域：动态加载选中组件，支持切换属性。
3. 右侧配置面板：
   - 属性控制（Input、Switch、Select）。
   - 事件触发查看（Console Log、Toast）。
4. 底部信息：使用文档链接、测试状态、版本信息。

## 数据驱动

`data/components.ts` 示例：

```ts
export const components = [
  {
    id: 'button',
    name: '按钮 Button',
    category: 'Base',
    componentPath: '/components/base/button/index',
    props: {
      type: { type: 'option', options: ['default', 'primary', 'secondary'] },
      size: { type: 'option', options: ['small', 'medium', 'large'] },
      loading: { type: 'boolean', default: false },
    },
    docs: '/docs/dev-environment/component-library.md#button',
  },
];
```

## 运行方式

- 在 `app.json` 中新增页面路径 `pages/component-lab/index`（仅在开发环境启用）。
- 使用 `wx.navigateTo({ url: '/pages/component-lab/index?id=button' })` 进入。
- 可通过环境变量控制是否显示（例如 `process.env.SHOW_COMPONENT_LAB`）。

## 调试工具

- 集成 `wx.showToast`、`console.log` 输出。
- 提供“自动截图”按钮，借助微信开发者工具导出组件截图。
- 配合 Jest Snapshot：保存 WXML 结构快照，检测变更。

## 对外同步

- 将 Component Lab 页面二维码在团队工具（飞书/企业微信）中固定。
- 每次组件发布时更新页面中展示的版本号与变更记录。
- 对设计/产品提供快速体验入口，减少微信包体多次安装。

## 权限与安全

- Component Lab 不应在生产包中发布：
  - 使用构建脚本在发布前移除 `app.json` 中的 `pages/component-lab/index`，或在构建流程中自动修改 manifest。
  - 或使用 `if (process.env.NODE_ENV !== 'production')` 控制注册。
  - 推荐在 CI 中新增检查，阻止包含 Component Lab 页面路径的发布提交。
- 若需对外演示，可构建专用体验版。

## 验收清单

- [ ] 组件目录与设计系统分类保持一致。
- [ ] 主流属性均可在界面中实时调整。
- [ ] 支持查看事件回调结果。
- [ ] 组件与文档链接跳转正常。
- [ ] 页面加载性能良好（首屏 < 1.5s）。
- [ ] 发布脚本自动移除生产环境中的 Component Lab。

## 后续规划

- 引入用例录制（录屏/动图）自动输出。
- 与测试脚本打通，执行自动化 smoke test。
- 增加深色模式、无障碍调试面板。
