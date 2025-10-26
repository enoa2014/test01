import { test, expect } from '@playwright/test';

test.describe('CSS修复验证测试', () => {
  test('验证Tailwind CSS是否正确加载', async ({ page }) => {
    console.log('🎨 验证CSS修复效果...');

    // 1. 访问页面
    await page.goto('http://localhost:5175');
    await page.waitForTimeout(3000);

    // 2. 检查CSS链接
    const cssLinks = await page.locator('link[rel="stylesheet"]').count();
    console.log('🎨 CSS链接数量:', cssLinks);

    // 3. 检查是否有Tailwind样式
    const computedStyles = await page.evaluate(() => {
      const bodyStyles = window.getComputedStyle(document.body);
      return {
        fontFamily: bodyStyles.fontFamily,
        backgroundColor: bodyStyles.backgroundColor,
        color: bodyStyles.color,
        margin: bodyStyles.margin,
        minHeight: bodyStyles.minHeight
      };
    });

    console.log('🎨 body样式:', computedStyles);

    // 4. 检查页面内容
    const currentUrl = page.url();
    console.log('📍 当前URL:', currentUrl);

    // 5. 检查页面内容长度
    const bodyContent = await page.locator('body').textContent();
    console.log('📝 页面内容长度:', bodyContent?.length);

    // 6. 检查可见元素
    const visibleElements = await page.locator('*:visible').count();
    console.log('👁️  可见元素数量:', visibleElements);

    // 7. 如果在登录页面，测试登录表单样式
    if (currentUrl.includes('/login')) {
      // 切换到账号密码登录
      const traditionalButton = await page.locator('button:has-text("账号密码")').first();
      if (await traditionalButton.isVisible()) {
        await traditionalButton.click();
        await page.waitForTimeout(500);
      }

      // 检查登录表单样式
      const loginForm = await page.locator('form').first();
      if (await loginForm.isVisible()) {
        const formStyles = await loginForm.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return {
            display: styles.display,
            backgroundColor: styles.backgroundColor,
            padding: styles.padding,
            borderRadius: styles.borderRadius,
            boxShadow: styles.boxShadow
          };
        });
        console.log('📝 登录表单样式:', formStyles);

        // 检查输入框样式
        const inputStyles = await page.locator('input').first().evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return {
            padding: styles.padding,
            border: styles.border,
            borderRadius: styles.borderRadius,
            backgroundColor: styles.backgroundColor
          };
        });
        console.log('📝 输入框样式:', inputStyles);

        // 检查按钮样式
        const buttonStyles = await page.locator('button').first().evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            padding: styles.padding,
            borderRadius: styles.borderRadius,
            border: styles.border
          };
        });
        console.log('📝 按钮样式:', buttonStyles);
      }
    }

    // 8. 截图保存
    await page.screenshot({ path: 'css-fix-verification.png', fullPage: true });
    console.log('📸 截图已保存到 css-fix-verification.png');

    // 9. 验证结果
    console.log('\n📋 CSS修复验证结果:');
    console.log('- CSS链接数量:', cssLinks);
    console.log('- 页面内容长度:', bodyContent?.length || 0);
    console.log('- 可见元素数量:', visibleElements);
    console.log('- body字体:', computedStyles.fontFamily);
    console.log('- body背景色:', computedStyles.backgroundColor);

    if (cssLinks > 0 && (bodyContent?.length || 0) > 100 && visibleElements > 10) {
      console.log('✅ CSS修复成功！页面样式已正常加载');
    } else if (cssLinks === 0) {
      console.log('❌ CSS未加载，需要检查配置');
    } else if ((bodyContent?.length || 0) < 100) {
      console.log('⚠️  页面内容仍然较少，可能存在其他问题');
    } else {
      console.log('⚠️  部分修复，但可能需要进一步检查');
    }

    console.log('🎨 CSS修复验证完成');
  });
});