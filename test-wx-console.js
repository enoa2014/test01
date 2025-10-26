/**
 * 微信开发者工具控制台测试脚本
 * 复制此代码到微信开发者工具控制台中执行
 */

console.log('=== 微信开发者工具二维码生成测试 ===');

// 测试1: 基础二维码生成测试
console.log('\n🧪 测试1: 基础二维码生成');
wx.cloud.callFunction({
  name: 'testQrGeneration',
  data: { testType: 'basic' }
}).then(res => {
  console.log('✅ 基础测试结果:', res);
  if (res.result && res.result.success) {
    console.log('✅ 二维码生成成功!');
    console.log('文件ID:', res.result.fileID);
    console.log('临时链接:', res.result.tempURL);
  } else {
    console.log('❌ 二维码生成失败');
    console.log('错误:', res.result?.error || res.result?.message || '未知错误');
  }
}).catch(err => {
  console.error('❌ 基础测试失败:', err);
});

// 测试2: 完整流程测试
console.log('\n🧪 测试2: 完整流程测试');
wx.cloud.callFunction({
  name: 'testQrGeneration',
  data: { testType: 'full' }
}).then(res => {
  console.log('✅ 完整流程测试结果:', res);
  if (res.result && res.result.success) {
    console.log('✅ 完整流程测试成功!');
    console.log('邀请码:', res.result.code);
    console.log('邀请ID:', res.result.inviteId);
    console.log('文件ID:', res.result.fileId);
    console.log('临时链接:', res.result.url);
  } else {
    console.log('❌ 完整流程测试失败');
    console.log('错误:', res.result?.error || res.result?.message || '未知错误');
  }
}).catch(err => {
  console.error('❌ 完整流程测试失败:', err);
});

// 测试3: 测试RBAC云函数（需要登录态）
console.log('\n🧪 测试3: RBAC云函数测试');
wx.cloud.callFunction({
  name: 'rbac',
  data: {
    action: 'createInvite',
    role: 'volunteer',
    uses: 1,
    note: '微信开发者工具测试'
  }
}).then(res => {
  console.log('✅ RBAC测试结果:', res);
  if (res.result && res.result.success) {
    console.log('✅ 邀请创建成功!');
    console.log('邀请码:', res.result.data.code);
    console.log('邀请ID:', res.result.data.inviteId);

    // 继续测试二维码生成
    return wx.cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'generateInviteQr',
        inviteId: res.result.data.inviteId
      }
    });
  } else {
    console.log('❌ 邀请创建失败');
    console.log('错误:', res.result?.error?.message || '未知错误');
    return null;
  }
}).then(res => {
  if (res) {
    console.log('✅ RBAC二维码生成结果:', res);
    if (res.result && res.result.success) {
      console.log('✅ RBAC二维码生成成功!');
      console.log('文件ID:', res.result.data.fileId);
      console.log('临时链接:', res.result.data.url);
    } else {
      console.log('❌ RBAC二维码生成失败');
      console.log('错误:', res.result?.error?.message || '未知错误');
    }
  }
}).catch(err => {
  console.error('❌ RBAC测试失败:', err);
});

console.log('\n📋 测试脚本已执行，请查看上方结果');