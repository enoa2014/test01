# Web Admin 测试维护指南

## 📋 概述

本文档为 web-admin 项目提供完整的测试维护指南，帮助开发者有效使用和维护现有的测试基础设施。

## 🚀 快速开始

### 运行所有测试
```bash
# 运行单元测试和组件测试
npm run test:run

# 运行E2E测试
npm run test:e2e

# 运行所有测试并生成覆盖率报告
npm run test:coverage
```

### 运行特定测试
```bash
# 运行单个组件测试
npm run test:run src/components/__tests__/AdminLayout.test.tsx

# 运行特定页面的测试
npm run test:run src/pages/__tests__/DashboardPage.test.tsx

# 运行特定Hook测试
npm run test:run src/hooks/__tests__/useCloudFunction.test.ts
```

### 测试UI界面
```bash
# 启动测试UI界面
npm run test:ui

# 启动E2E测试UI界面
npm run test:e2e:ui
```

## 📊 测试结构概览

### 组件测试 (Component Tests)
```
src/components/__tests__/
├── AdminLayout.test.tsx          # 管理布局组件 (24个测试)
├── AdminRouteGuard.test.tsx      # 路由守卫组件 (23个测试)
├── MediaManager.test.tsx         # 媒体管理组件 (31个测试)
└── MediaManager.fixed.test.tsx   # 媒体管理组件修复版 (14个测试)
```

### 页面测试 (Page Tests)
```
src/pages/__tests__/
├── DashboardPage.test.tsx        # 仪表盘页面 (31个测试)
├── PatientListPage.test.tsx      # 患者列表页面 (20个测试)
├── ImportPage.test.tsx           # 导入页面 (16个测试)
├── ExportPage.test.tsx           # 导出页面 (22个测试)
├── AuditPage.test.tsx            # 审计页面 (26个测试)
├── SettingsPage.test.tsx         # 设置页面 (30个测试)
└── InvitesPage.test.tsx          # 邀请页面 (16个测试)
```

### Hook测试 (Hook Tests)
```
src/hooks/__tests__/
├── useCloudFunction.test.ts           # 主要云函数Hook (15个测试)
├── useCloudFunction.simple.test.ts    # 简化版本 (14个测试)
├── useCloudFunction.complete.test.ts  # 完整版本 (16个测试)
└── useCloudFunction.optimized.test.ts # 优化版本 (12个测试)
```

### E2E测试 (End-to-End Tests)
```
e2e/
└── comprehensive-workflow.spec.ts     # 综合工作流测试 (12个测试)
```

## 🔧 日常维护任务

### 1. 代码修改后的测试检查
当你修改了组件或页面代码后：

```bash
# 运行相关测试
npm run test:run src/components/__tests__/YourComponent.test.tsx

# 如果需要，运行E2E测试
npm run test:e2e -- --grep "相关功能描述"
```

### 2. 添加新组件时的测试模板

#### 组件测试模板
```typescript
import { render, screen, fireEvent, waitFor } from '@vitest/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import YourComponent from '../YourComponent';

describe('YourComponent', () => {
  beforeEach(() => {
    // 设置测试环境
  });

  afterEach(() => {
    // 清理测试环境
  });

  it('应该能够正常渲染组件', () => {
    render(<YourComponent />);
    // 添加你的测试断言
  });

  it('应该处理用户交互', async () => {
    render(<YourComponent />);
    // 测试用户交互
  });

  it('应该正确处理props', () => {
    const props = { /* 测试props */ };
    render(<YourComponent {...props} />);
    // 测试props处理
  });
});
```

#### E2E测试模板
```typescript
import { test, expect } from '@playwright/test';

test.describe('新功能测试', () => {
  test.beforeEach(async ({ page }) => {
    // 设置E2E测试bypass
    await page.goto('http://localhost:5178');
    await page.evaluate(() => {
      localStorage.setItem('E2E_BYPASS_LOGIN', '1');
    });

    // 等待页面加载
    await page.waitForLoadState('networkidle');
  });

  test('应该能够正常访问新功能', async ({ page }) => {
    // 添加E2E测试逻辑
  });
});
```

### 3. 修改测试Mock配置

测试Mock配置位于 `src/test/setup.ts`：

```typescript
// 添加新的Mock服务
vi.mock('../services/yourNewService', () => ({
  default: {
    methodName: vi.fn().mockResolvedValue({ success: true }),
  },
}));
```

### 4. 处理测试失败

#### 常见测试失败原因和解决方案

**1. Mock不匹配**
```bash
# 错误: Cannot find module
# 解决: 检查import路径和Mock配置
```

**2. 异步测试超时**
```bash
# 错误: Test timeout
# 解决: 增加超时时间或使用waitFor
await waitFor(() => {
  expect(screen.getByText('期望文本')).toBeInTheDocument();
}, { timeout: 10000 });
```

**3. E2E测试端口问题**
```bash
# 确保开发服务器在正确端口运行
npm run dev:all

# 或更新playwright.config.ts中的端口配置
```

## 📈 性能监控

### 测试执行时间监控
```bash
# 查看测试执行时间
npm run test:run -- --reporter=verbose

# 生成性能报告
npm run test:run -- --reporter=json --outputFile=test-results.json
```

### 覆盖率监控
```bash
# 生成覆盖率报告
npm run test:coverage

# 查看覆盖率详情
open coverage/index.html
```

## 🐛 调试技巧

### 1. 组件测试调试
```typescript
// 在测试中添加console.log
console.log(screen.debug());

// 使用screen.debug()打印DOM
screen.debug();

// 使用only运行单个测试
it.only('调试单个测试', () => {
  // 测试逻辑
});
```

### 2. E2E测试调试
```bash
# 运行 headed 模式查看浏览器
npm run test:e2e:headed

# 生成trace文件进行调试
npm run test:e2e -- --trace on

# 查看trace
npx playwright show-trace trace.zip
```

### 3. 使用Playwright Inspector
```bash
# 启用调试模式
PWDEBUG=1 npm run test:e2e
```

## 🔄 持续集成配置

### GitHub Actions示例
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:run
      - run: npm run test:e2e
```

## 📝 测试最佳实践

### 1. 测试命名规范
- 使用描述性的测试名称
- 格式: "应该[期望行为]当[条件]时"
- 中文命名更易理解

### 2. 测试结构
```typescript
describe('ComponentName', () => {
  describe('基础功能', () => {
    it('应该正常渲染', () => {});
  });

  describe('用户交互', () => {
    it('应该处理点击事件', () => {});
  });

  describe('边界情况', () => {
    it('应该处理空数据', () => {});
  });
});
```

### 3. Mock使用原则
- Mock外部依赖，不Mock被测试的代码
- 保持Mock的一致性和可维护性
- 为不同的测试场景提供不同的Mock数据

### 4. 异步测试
```typescript
// 使用waitFor等待异步操作
await waitFor(() => {
  expect(screen.getByText('加载完成')).toBeInTheDocument();
});

// 使用act包装状态更新
await act(async () => {
  fireEvent.click(screen.getByText('提交'));
});
```

## 🚨 常见问题解决

### 1. 测试环境问题
```bash
# 清理缓存
npm run test:run -- --no-cache

# 重新安装依赖
rm -rf node_modules package-lock.json
npm install
```

### 2. E2E测试问题
```bash
# 重新安装Playwright浏览器
npx playwright install

# 检查端口占用
netstat -an | grep :5178
```

### 3. Mock配置问题
```bash
# 检查Mock文件路径
find src -name "*.test.*" | xargs grep -l "vi.mock"

# 验证Mock配置
npm run test:run src/test/setup.test.ts
```

## 📚 参考资源

- [Vitest官方文档](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright官方文档](https://playwright.dev/)
- [JavaScript测试最佳实践](https://github.com/goldbergyoni/javascript-testing-best-practices)

## 🤝 贡献指南

### 添加新测试
1. 确定测试类型（组件/页面/Hook/E2E）
2. 使用对应的模板创建测试文件
3. 遵循命名和结构规范
4. 添加适当的Mock配置
5. 确保测试通过并提供良好的覆盖率

### 修改现有测试
1. 理解测试的目的和覆盖范围
2. 保持测试的可读性和维护性
3. 更新相关的Mock配置
4. 运行完整的测试套件确保没有破坏性更改

---

**最后更新**: 2025年10月17日
**维护者**: Claude Code Assistant
**版本**: v1.0