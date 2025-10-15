import { test, expect } from '@playwright/test';

test('调试：分析页面实际内容', async ({ page }) => {
  // 先进行登录
  await page.goto('http://localhost:5176/login');
  await page.waitForLoadState('networkidle');

  // 填写登录信息
  await page.fill('input[placeholder*="用户名"], input[name="username"], input[type="text"]', 'admin');
  await page.fill('input[placeholder*="口令"], input[name="password"], input[type="password"]', 'admin');

  // 点击登录按钮
  await page.click('button[type="submit"], button:has-text("登录")');
  await page.waitForTimeout(2000);

  // 导航到分析页面
  await page.goto('http://localhost:5176/analysis');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  // 截图
  await page.screenshot({ path: 'debug-analysis-page.png', fullPage: true });

  // 获取页面标题
  const title = await page.title();
  console.log('页面标题:', title);

  // 获取页面内容
  const bodyText = await page.locator('body').textContent();
  console.log('页面内容长度:', bodyText?.length);

  // 查找所有h1元素
  const h1Elements = await page.locator('h1').all();
  console.log('找到的h1元素数量:', h1Elements.length);

  for (let i = 0; i < h1Elements.length; i++) {
    const text = await h1Elements[i].textContent();
    console.log(`h1[${i}]:`, text);
  }

  // 查找包含"分析"的文本
  const analysisElements = await page.locator('text=分析').all();
  console.log('包含"分析"的元素数量:', analysisElements.length);

  // 查找所有按钮
  const buttons = await page.locator('button').all();
  console.log('页面上的按钮数量:', buttons.length);

  for (let i = 0; i < Math.min(10, buttons.length); i++) {
    const text = await buttons[i].textContent();
    console.log(`按钮[${i}]:`, text);
  }

  // 检查控制台错误
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log('控制台错误:', msg.text());
    }
  });

  await page.waitForTimeout(3000);
  console.log('总控制台错误数量:', errors.length);
});