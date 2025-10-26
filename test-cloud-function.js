/**
 * 直接测试云函数二维码生成
 */

// 设置环境变量（请根据您的实际环境调整）
// 请在运行时设置这些环境变量：
// export TCB_ENV=cloud1-6g2fzr5f7cf51e38
// export TENCENTCLOUD_SECRETID=your_secret_id
// export TENCENTCLOUD_SECRETKEY=your_secret_key
if (!process.env.TCB_ENV) {
  console.error('请设置环境变量 TCB_ENV');
  process.exit(1);
}
if (!process.env.TENCENTCLOUD_SECRETID || !process.env.TENCENTCLOUD_SECRETKEY) {
  console.error('请设置环境变量 TENCENTCLOUD_SECRETID 和 TENCENTCLOUD_SECRETKEY');
  process.exit(1);
}

const tcb = require('tcb-admin-node');

// 初始化云开发
const app = tcb.init({
  env: process.env.TCB_ENV,
  secretId: process.env.TENCENTCLOUD_SECRETID,
  secretKey: process.env.TENCENTCLOUD_SECRETKEY
});

async function testQrGeneration() {
  console.log('=== 开始测试二维码生成功能 ===');

  try {
    // 测试1: 基础二维码生成测试
    console.log('\n1. 执行基础二维码生成测试...');
    try {
      const basicTest = await app.callFunction({
        name: 'testQrGeneration',
        data: {
          testType: 'basic'
        }
      });

      console.log('基础测试结果:', JSON.stringify(basicTest.result, null, 2));

      if (basicTest.result && basicTest.result.success) {
        console.log('✅ 基础二维码生成测试成功！');
        console.log('生成的二维码文件ID:', basicTest.result.fileID);
        console.log('临时访问链接:', basicTest.result.tempURL);
      } else {
        console.log('❌ 基础二维码生成测试失败');
        console.log('错误信息:', basicTest.result?.error || '未知错误');
        console.log('错误详情:', basicTest.result?.details || '');
      }
    } catch (error) {
      console.error('❌ 基础测试执行失败:', error);
    }

    // 测试2: 测试实际的rbac云函数二维码生成
    console.log('\n2. 测试实际rbac云函数二维码生成...');
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

      console.log('创建邀请结果:', JSON.stringify(createInviteResult.result, null, 2));

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

        console.log('RBAC二维码生成结果:', JSON.stringify(qrResult.result, null, 2));

        if (qrResult.result && qrResult.result.success) {
          console.log('✅ RBAC云函数二维码生成成功！');
          console.log('二维码文件ID:', qrResult.result.data.fileId);
          console.log('临时访问链接:', qrResult.result.data.url);
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

// 执行测试
testQrGeneration().then(() => {
  console.log('\n所有测试执行完毕');
  process.exit(0);
}).catch(error => {
  console.error('\n测试执行失败:', error);
  process.exit(1);
});