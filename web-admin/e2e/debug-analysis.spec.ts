import { test, expect } from '@playwright/test';

test('调试：检查页面实际内容', async ({ page }) => {
  // 导航到分析页面
  await page.goto('http://localhost:5177/analysis');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // 截图
  await page.screenshot({ path: 'debug-page-content.png', fullPage: true });

  // 获取页面标题
  const title = await page.title();
  console.log('页面标题:', title);

  // 获取页面内容
  const bodyText = await page.locator('body').textContent();
  console.log('页面内容片段:', bodyText?.substring(0, 200));

  // 查找所有h1元素
  const h1Elements = await page.locator('h1').all();
  console.log('找到的h1元素数量:', h1Elements.length);

  for (let i = 0; i < h1Elements.length; i++) {
    const text = await h1Elements[i].textContent();
    console.log(`h1[${i}]:`, text);
  }

  // 检查是否存在路由问题
  const url = page.url();
  console.log('当前URL:', url);

  // 检查是否被重定向
  if (url.includes('/login')) {
    console.log('页面被重定向到登录页面');
  } else if (url.includes('/404') || url.includes('not-found')) {
    console.log('页面被重定向到404页面');
  }
});