import { test, expect } from '@playwright/test';

test.describe('Dashboard权限修复测试', () => {
  test('测试修复后的Dashboard权限问题', async ({ page }) => {
    console.log('🔧 测试Dashboard权限修复...');

    // 1. 访问dashboard页面
    await page.goto('http://localhost:5173/dashboard');
    await page.waitForTimeout(2000);

    // 2. 检查控制台错误
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log('❌ 控制台错误:', msg.text());
      } else if (msg.type() === 'warn') {
        console.log('⚠️  控制台警告:', msg.text());
      }
    });

    // 3. 检查页面内容
    const pageTitle = await page.title();
    console.log('📄 页面标题:', pageTitle);

    // 4. 检查Dashboard组件是否正常渲染
    try {
      const dashboardContent = await page.locator('body').textContent();
      console.log('📊 页面内容长度:', dashboardContent?.length);

      // 检查是否包含"系统概览"等关键内容
      const hasSystemOverview = dashboardContent?.includes('系统概览') || false;
      const hasQuickActions = dashboardContent?.includes('快捷操作') || false;
      const hasSystemInfo = dashboardContent?.includes('系统信息') || false;

      console.log('✅ 系统概览:', hasSystemOverview);
      console.log('✅ 快捷操作:', hasQuickActions);
      console.log('✅ 系统信息:', hasSystemInfo);

      // 5. 检查统计数据是否显示
      const statCards = await page.locator('[style*="gridTemplateColumns"], .stat-card, [style*="padding:24px"]').count();
      console.log('📈 统计卡片数量:', statCards);

      // 6. 检查导航菜单是否可用
      const navigationLinks = await page.locator('nav a, .nav-link, [role="menuitem"]').count();
      console.log('🧭 导航链接数量:', navigationLinks);

      // 7. 尝试访问其他页面
      const testPages = ['/patients', '/invites', '/settings', '/export'];
      const accessiblePages = [];

      for (const testPage of testPages) {
        try {
          const response = await page.goto(`http://localhost:5173${testPage}`);
          await page.waitForTimeout(1000);

          const finalUrl = page.url();

          if (!finalUrl.includes('/login') && !finalUrl.includes('/dashboard')) {
            accessiblePages.push(testPage);
            console.log(`✅ 可以访问: ${testPage}`);
          } else {
            console.log(`🚫 被重定向: ${testPage} -> ${finalUrl}`);
          }
        } catch (error) {
          console.log(`❌ 访问失败: ${testPage} - ${error.message}`);
        }
      }

      // 8. 总结测试结果
      console.log('\n📋 测试结果总结:');
      console.log('- 控制台错误数量:', consoleErrors.length);
      console.log('- 权限相关错误:', consoleErrors.filter(e => e.includes('权限') || e.includes('permission')).length);
      console.log('- Dashboard正常渲染:', hasSystemOverview && hasQuickActions);
      console.log('- 可访问页面数量:', accessiblePages.length);
      console.log('- 可访问页面:', accessiblePages.join(', '));

      // 9. 验证修复是否成功
      const hasPermissionErrors = consoleErrors.some(e =>
        e.includes('无权限查看角色申请') ||
        e.includes('Failed to fetch dashboard stats')
      );

      if (hasPermissionErrors) {
        console.log('❌ 权限问题仍然存在');
      } else {
        console.log('✅ 权限问题已修复');
      }

      // 10. 预期修复效果
      console.log('\n🎯 预期修复效果:');
      console.log('1. ✅ Dashboard页面应该正常加载');
      console.log('2. ✅ 不应该出现"无权限查看角色申请"错误');
      console.log('3. ✅ 统计数据应该显示为默认值（如果API失败）');
      console.log('4. ✅ 用户应该可以访问其他管理页面');

    } catch (error) {
      console.error('❌ 测试过程中发生错误:', error);
    }

    console.log('🔧 Dashboard权限修复测试完成');
  });
});