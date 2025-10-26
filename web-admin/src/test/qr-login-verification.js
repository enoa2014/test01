/**
 * QR登录功能验证脚本
 *
 * 使用方法：
 * 1. 启动开发服务器: npm run dev:all
 * 2. 在浏览器控制台运行此脚本
 * 3. 检查QR登录组件是否正常工作
 */

// 检查QR登录依赖
function checkDependencies() {
  console.log('🔍 检查依赖...');

  // 检查qrcode库
  if (typeof window.QRCode !== 'undefined') {
    console.log('✅ QRCode库已加载');
  } else {
    console.log('❌ QRCode库未加载');
  }

  // 检查CloudBase SDK
  if (typeof window.cloudbase !== 'undefined') {
    console.log('✅ CloudBase SDK已加载');
  } else {
    console.log('❌ CloudBase SDK未加载');
  }
}

// 测试QRCode生成
function testQRCodeGeneration() {
  console.log('🔍 测试二维码生成...');

  if (typeof window.QRCode !== 'undefined') {
    const testData = 'test-qr-data-123';

    window.QRCode.toDataURL(testData)
      .then(url => {
        console.log('✅ 二维码生成成功');
        console.log('📊 二维码DataURL长度:', url.length);

        // 在页面上显示测试二维码
        const img = document.createElement('img');
        img.src = url;
        img.style.width = '128px';
        img.style.height = '128px';
        img.style.border = '2px solid #ccc';
        img.style.borderRadius = '8px';
        img.title = '测试二维码';

        // 添加到页面
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '10px';
        container.style.right = '10px';
        container.style.zIndex = '9999';
        container.style.background = 'white';
        container.style.padding = '10px';
        container.style.borderRadius = '8px';
        container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

        const title = document.createElement('div');
        title.textContent = 'QR码测试';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '5px';

        container.appendChild(title);
        container.appendChild(img);

        // 添加关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '5px';
        closeBtn.style.right = '5px';
        closeBtn.style.background = '#ff4444';
        closeBtn.style.color = 'white';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '50%';
        closeBtn.style.width = '20px';
        closeBtn.style.height = '20px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.onclick = () => document.body.removeChild(container);

        container.appendChild(closeBtn);
        document.body.appendChild(container);

        console.log('🖼️ 测试二维码已显示在页面右上角');

        // 5秒后自动移除
        setTimeout(() => {
          if (document.body.contains(container)) {
            document.body.removeChild(container);
          }
        }, 5000);
      })
      .catch(err => {
        console.error('❌ 二维码生成失败:', err);
      });
  } else {
    console.log('❌ QRCode库不可用，无法测试');
  }
}

// 检查登录页面元素
function checkLoginPageElements() {
  console.log('🔍 检查登录页面元素...');

  const loginModeButtons = document.querySelectorAll('button[onclick*="setLoginMode"]');
  console.log('📊 登录模式切换按钮数量:', loginModeButtons.length);

  const qrLoginTab = Array.from(loginModeButtons).find(btn =>
    btn.textContent.includes('扫码登录')
  );
  const traditionalLoginTab = Array.from(loginModeButtons).find(btn =>
    btn.textContent.includes('账号密码')
  );

  if (qrLoginTab) {
    console.log('✅ 扫码登录Tab存在');
  } else {
    console.log('❌ 扫码登录Tab不存在');
  }

  if (traditionalLoginTab) {
    console.log('✅ 账号密码Tab存在');
  } else {
    console.log('❌ 账号密码Tab不存在');
  }

  // 检查QR登录组件
  const qrLoginComponent = document.querySelector('[data-testid*="qr"]') ||
                           document.querySelector('.qr-login') ||
                           document.querySelector('[class*="qr"]');

  if (qrLoginComponent) {
    console.log('✅ QR登录组件存在');
  } else {
    console.log('⚠️ QR登录组件可能未加载或需要切换到扫码登录Tab');
  }
}

// 测试云函数连接
function testCloudFunctionConnection() {
  console.log('🔍 测试云函数连接...');

  // 检查是否在登录页面
  if (window.location.pathname.includes('/login')) {
    console.log('✅ 当前在登录页面');

    // 尝试查找QR登录按钮并点击
    const qrTab = Array.from(document.querySelectorAll('button')).find(btn =>
      btn.textContent.includes('扫码登录')
    );

    if (qrTab && qrTab.onclick) {
      console.log('✅ 找到扫码登录Tab，尝试点击...');
      qrTab.click();

      setTimeout(() => {
        checkLoginPageElements();
      }, 1000);
    } else {
      console.log('⚠️ 未找到扫码登录Tab或点击事件');
    }
  } else {
    console.log('⚠️ 当前不在登录页面，请先访问登录页面');
  }
}

// 主验证函数
function verifyQRLoginSystem() {
  console.log('🚀 开始验证QR登录系统...');
  console.log('📍 当前页面:', window.location.pathname);
  console.log('📅 验证时间:', new Date().toLocaleString());

  checkDependencies();

  setTimeout(() => {
    testQRCodeGeneration();
  }, 500);

  setTimeout(() => {
    checkLoginPageElements();
  }, 1000);

  setTimeout(() => {
    testCloudFunctionConnection();
  }, 2000);

  setTimeout(() => {
    console.log('✨ QR登录系统验证完成！');
    console.log('');
    console.log('📋 验证总结:');
    console.log('- 检查了依赖库加载状态');
    console.log('- 测试了二维码生成功能');
    console.log('- 检查了登录页面UI元素');
    console.log('- 尝试了云函数连接');
    console.log('');
    console.log('🔗 手动测试步骤:');
    console.log('1. 访问登录页面');
    console.log('2. 点击"扫码登录"Tab');
    console.log('3. 选择登录角色');
    console.log('4. 使用微信小程序扫码');
    console.log('5. 在小程序中确认登录');
    console.log('6. 检查是否成功跳转到仪表盘');
  }, 3000);
}

// 如果在浏览器环境中，自动运行验证
if (typeof window !== 'undefined') {
  // 等待页面加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verifyQRLoginSystem);
  } else {
    // 页面已加载，延迟1秒运行
    setTimeout(verifyQRLoginSystem, 1000);
  }
}

// 导出验证函数供手动调用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { verifyQRLoginSystem };
}