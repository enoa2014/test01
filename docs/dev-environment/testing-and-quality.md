# 测试与质量保障策略

## 目标
- 覆盖基础组件与关键业务逻辑的单元测试，目标覆盖率 ≥ 80%。
- 在 CI 中执行质量门禁，保障提交的可靠性。
- 提供统一的测试目录与工具配置，减少重复劳动。

## 测试类型
| 类型 | 说明 | 工具 |
|------|------|------|
| 单元测试 | 组件属性、事件、渲染逻辑 | Jest + miniprogram-simulate |
| 视觉/交互回归 | 样式和交互快照 | Jest Snapshot + 微信开发者工具自动化（可选） |
| 无障碍检查 | ARIA、键盘导航、对比度 | axe-core（自定义）或手动 checklist |
| 性能监控 | 构建体积、渲染耗时 | 自定义脚本 + 微信性能面板 |

## 目录结构
```
tests/
├─ unit/
│   ├─ setup.ts            # 全局 mock
│   ├─ components/
│   │   ├─ button.test.ts
│   │   └─ ...
│   └─ utils/
└─ e2e/                    # 可选，留待后续扩展
```

## Jest 配置要点
```js
// jest.config.js
module.exports = {
  testMatch: ['<rootDir>/tests/unit/**/*.test.(js|ts)'],
  setupFilesAfterEnv: ['<rootDir>/tests/unit/setup.ts'],
  moduleFileExtensions: ['js', 'ts', 'json'],
  transform: {
    '^.+\\.(ts|js)$': 'ts-jest'
  },
  testEnvironment: 'jsdom',
  collectCoverage: true,
  collectCoverageFrom: [
    'miniprogram/components/**/*.{js,ts}',
    '!miniprogram/**/index.{js,ts}'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### setup.ts 示例
```ts
import simulate from 'miniprogram-simulate';

global.wx = {
  showToast: jest.fn(),
  navigateTo: jest.fn(),
  // ...补齐常用 API mock
};

global.simulate = simulate;
```

## 组件测试示例
```ts
import simulate from 'miniprogram-simulate';

const id = simulate.load('/components/base/button/index');
const comp = simulate.render(id, { type: 'primary', loading: false });

describe('pm-button', () => {
  it('渲染文本', () => {
    expect(comp.querySelector('.pm-button__text').text()).toBe('按钮');
  });

  it('触发点击事件', () => {
    const onClick = jest.fn();
    comp.instance.onClick = onClick;
    simulate.tap(comp.querySelector('.pm-button'));
    expect(onClick).toBeCalled();
  });
});
```

## Stylelint / ESLint
- 在 CI 中执行 `pnpm lint`，阻止不符合规范的提交。
- 对关键目录（components, utils, pages）加入 `tsconfig.json` 路径别名以提升可维护性。

## 质量门禁
1. CI Pipeline 顺序：
   1. 安装依赖
   2. Lint（JS + WXSS）
   3. 单元测试 + 覆盖率
   4. 构建校验（使用微信 CLI 或自定义编译脚本）
   5. 体积分析（可选）
2. 若任一环节失败，阻止合并。
3. 通过 GitHub Checks 或飞书机器人通知结果。

## 测试数据与 Mock
- 使用 `tests/fixtures` 存放静态数据，避免散落在代码中。
- 推荐以 JSON 文件或 TS 常量方式集中管理。
- 对异步请求使用 `wx.request` mock，返回可控数据。

## 手动验证清单（补充）
- 样式在 iOS/Android 微信环境下是否一致。
- 微信无障碍扫描是否通过（尤其按钮、输入框）。
- Dark Mode 或高对比度模式下的可读性。
- 极端数据（长文本、空数据、网络错误）的表现。

## 里程碑
- Sprint 1：完成 Base 组件单元测试与基础覆盖率。
- Sprint 2：集成覆盖率报告至 CI，并接入 Codecov（可选）。
- Sprint 3：探索 E2E（基于微信开发者工具 CLI）与视觉回归方案。

## 最佳实践
- 组件新增属性必须同步新增/更新测试用例。
- 在 PR 模板中勾选“已完成测试”。
- 定期查看 Jest 运行时长，拆分过慢用例。
- 对常见场景使用 Snapshot，但避免大规模快照污染。
