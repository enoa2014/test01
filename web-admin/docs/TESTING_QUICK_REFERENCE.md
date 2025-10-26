# 🚀 测试快速参考卡

## 常用命令

### 单元测试
```bash
npm run test:run                    # 运行所有测试
npm run test:run src/path/to/test  # 运行特定测试
npm run test:ui                     # 测试UI界面
npm run test:coverage               # 生成覆盖率报告
```

### E2E测试
```bash
npm run test:e2e                    # 运行E2E测试
npm run test:e2e:headed             # 有界面模式
npm run test:e2e:ui                 # E2E测试UI
npm run e2e:report                  # 查看测试报告
```

## 测试文件结构

```
src/
├── components/__tests__/          # 组件测试
├── pages/__tests__/               # 页面测试
├── hooks/__tests__/               # Hook测试
└── test/setup.ts                  # 全局Mock配置

e2e/
└── comprehensive-workflow.spec.ts # E2E测试
```

## 测试模板

### 组件测试
```typescript
import { render, screen } from '@vitest/react';
import { describe, it, expect } from 'vitest';
import Component from '../Component';

describe('Component', () => {
  it('应该正常渲染', () => {
    render(<Component />);
    expect(screen.getByText('期望文本')).toBeInTheDocument();
  });
});
```

### E2E测试
```typescript
import { test, expect } from '@playwright/test';

test('基本功能测试', async ({ page }) => {
  await page.goto('http://localhost:5178');
  await page.evaluate(() => {
    localStorage.setItem('E2E_BYPASS_LOGIN', '1');
  });
  await expect(page.getByText('期望内容')).toBeVisible();
});
```

## 调试技巧

### 组件测试调试
```typescript
screen.debug();                    // 打印DOM
console.log(element);             // 打印元素
it.only('只运行这个测试', () => {}); // 只运行特定测试
```

### E2E测试调试
```bash
npm run test:e2e:headed           # 有界面调试
PWDEBUG=1 npm run test:e2e        # 调试模式
npx playwright show-trace trace.zip # 查看trace
```

## 常见问题

### 测试失败
- 检查Mock配置 `src/test/setup.ts`
- 验证import路径
- 增加异步等待时间

### E2E问题
- 确保开发服务器运行在端口5178
- 设置E2E_BYPASS_LOGIN='1'
- 检查网络状态和加载时间

## 性能监控

```bash
# 测试执行时间
npm run test:run -- --reporter=verbose

# 覆盖率报告
npm run test:coverage
```

---

📖 **详细文档**: [TESTING_MAINTENANCE_GUIDE.md](./TESTING_MAINTENANCE_GUIDE.md)