/**
 * Web管理端二维码生成测试
 * 在浏览器控制台中运行此脚本来测试二维码生成功能
 */

async function testQrGeneration() {
  console.log('=== 开始测试二维码生成功能 ===');

  try {
    // 检查是否在正确的环境中
    if (!window.app || !window.app.cloud) {
      console.error('❌ 云开发未初始化，请确保在Web管理端页面中运行此脚本');
      return;
    }

    const app = window.app.cloud;

    // 测试1: 基础二维码生成测试
    console.log('\n1. 执行基础二维码生成测试...');
    try {
      const basicTest = await app.callFunction({
        name: 'testQrGeneration',
        data: {
          testType: 'basic'
        }
      });

      console.log('基础测试结果:', basicTest);

      if (basicTest.result && basicTest.result.success) {
        console.log('✅ 基础二维码生成测试成功！');
        console.log('生成的二维码文件ID:', basicTest.result.fileID);
        console.log('临时访问链接:', basicTest.result.tempURL);

        // 尝试显示二维码图片
        if (basicTest.result.tempURL) {
          const img = new Image();
          img.src = basicTest.result.tempURL;
          img.style.maxWidth = '200px';
          img.style.border = '1px solid #ccc';
          console.log('二维码图片:', img);
          document.body.appendChild(img);
        }
      } else {
        console.log('❌ 基础二维码生成测试失败');
        console.log('错误信息:', basicTest.result?.error || '未知错误');
        console.log('错误详情:', basicTest.result?.details || '');
      }
    } catch (error) {
      console.error('❌ 基础测试执行失败:', error);
    }

    // 测试2: 完整邀请码二维码生成测试
    console.log('\n2. 执行完整邀请码二维码生成测试...');
    try {
      const fullTest = await app.callFunction({
        name: 'testQrGeneration',
        data: {
          testType: 'full'
        }
      });

      console.log('完整测试结果:', fullTest);

      if (fullTest.result && fullTest.result.success) {
        console.log('✅ 完整邀请码二维码生成测试成功！');
        console.log('生成的邀请码:', fullTest.result.code);
        console.log('邀请ID:', fullTest.result.inviteId);
        console.log('二维码文件ID:', fullTest.result.fileId);
        console.log('临时访问链接:', fullTest.result.url);

        // 尝试显示二维码图片
        if (fullTest.result.url) {
          const img = new Image();
          img.src = fullTest.result.url;
          img.style.maxWidth = '200px';
          img.style.border = '1px solid #ccc';
          img.style.marginTop = '10px';
          console.log('邀请二维码图片:', img);
          document.body.appendChild(img);
        }
      } else {
        console.log('❌ 完整邀请码二维码生成测试失败');
        console.log('错误信息:', fullTest.result?.error || '未知错误');
        console.log('错误详情:', fullTest.result?.details || '');
      }
    } catch (error) {
      console.error('❌ 完整测试执行失败:', error);
    }

    // 测试3: 测试实际的rbac云函数二维码生成
    console.log('\n3. 测试实际rbac云函数二维码生成...');
    try {
      // 首先创建一个测试邀请
      const createInviteResult = await app.callFunction({
        name: 'rbac',
        data: {
          action: 'createInvite',
          role: 'volunteer',
          uses: 1,
          note: '测试二维码生成'
        }
      });

      console.log('创建邀请结果:', createInviteResult);

      if (createInviteResult.result && createInviteResult.result.success) {
        const { code, inviteId } = createInviteResult.result.data;
        console.log(`✅ 测试邀请创建成功: ${code}`);

        // 尝试为这个邀请生成二维码
        const qrResult = await app.callFunction({
          name: 'rbac',
          data: {
            action: 'generateInviteQr',
            inviteId: inviteId
          }
        });

        console.log('RBAC二维码生成结果:', qrResult);

        if (qrResult.result && qrResult.result.success) {
          console.log('✅ RBAC云函数二维码生成成功！');
          console.log('二维码文件ID:', qrResult.result.data.fileId);
          console.log('临时访问链接:', qrResult.result.data.url);

          // 尝试显示二维码图片
          if (qrResult.result.data.url) {
            const img = new Image();
            img.src = qrResult.result.data.url;
            img.style.maxWidth = '200px';
            img.style.border = '1px solid #ccc';
            img.style.marginTop = '10px';
            console.log('RBAC二维码图片:', img);
            document.body.appendChild(img);
          }
        } else {
          console.log('❌ RBAC云函数二维码生成失败');
          console.log('错误信息:', qrResult.result?.error?.message || '未知错误');
          console.log('错误代码:', qrResult.result?.error?.code || '');
          console.log('错误详情:', qrResult.result?.error?.details || '');
        }
      } else {
        console.log('❌ 创建测试邀请失败');
        console.log('错误信息:', createInviteResult.result?.error?.message || '未知错误');
      }
    } catch (error) {
      console.error('❌ RBAC测试执行失败:', error);
    }

    console.log('\n=== 测试完成 ===');

  } catch (error) {
    console.error('测试过程中发生错误:', error);
    console.error('错误详情:', error.message || JSON.stringify(error));
  }
}

// 导出测试函数，可以在浏览器控制台中调用
window.testQrGeneration = testQrGeneration;

console.log('二维码测试脚本已加载！请在浏览器控制台中运行: testQrGeneration()');