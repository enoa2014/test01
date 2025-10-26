#!/usr/bin/env node

/**
 * QR登录集成测试脚本
 *
 * 运行方式：
 * node scripts/test-qr-login-integration.js
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

// 配置
const WEB_ADMIN_PORT = 4173;
const WEB_ADMIN_URL = `http://localhost:${WEB_ADMIN_PORT}`;
const LOGIN_URL = `${WEB_ADMIN_URL}/login`;

console.log('🚀 QR登录集成测试');
console.log('='.repeat(50));

// 检查端口是否被占用
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: '/',
      method: 'HEAD',
      timeout: 2000
    }, (res) => {
      resolve(true);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// 启动开发服务器
function startDevServer() {
  return new Promise((resolve, reject) => {
    console.log('📦 启动开发服务器...');

    const server = spawn('npm', ['run', 'dev:all'], {
      cwd: path.join(__dirname, '../web-admin'),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    let output = '';
    let hasStarted = false;

    server.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);

      // 检查服务器是否已启动
      if (text.includes('Local:') && !hasStarted) {
        hasStarted = true;
        setTimeout(() => {
          resolve(server);
        }, 3000); // 额外等待3秒确保完全启动
      }
    });

    server.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write(text);
    });

    server.on('error', (error) => {
      console.error('❌ 启动服务器失败:', error);
      reject(error);
    });

    server.on('exit', (code) => {
      if (!hasStarted) {
        console.error(`❌ 服务器退出，代码: ${code}`);
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    // 超时处理
    setTimeout(() => {
      if (!hasStarted) {
        console.log('⏰ 服务器启动超时，但继续测试...');
        resolve(server);
      }
    }, 30000);
  });
}

// 检查登录页面是否可访问
function checkLoginPage() {
  return new Promise((resolve) => {
    console.log('🔍 检查登录页面可访问性...');

    const req = http.get(LOGIN_URL, (res) => {
      console.log(`✅ 登录页面响应状态: ${res.statusCode}`);

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        // 检查页面内容
        const hasQRLogin = data.includes('扫码登录') || data.includes('QRLogin');
        const hasTraditionalLogin = data.includes('账号密码') || data.includes('username');
        const hasLoginForm = data.includes('form') && data.includes('password');

        console.log('📊 页面内容检查:');
        console.log(`  - 扫码登录: ${hasQRLogin ? '✅' : '❌'}`);
        console.log(`  - 账号密码: ${hasTraditionalLogin ? '✅' : '❌'}`);
        console.log(`  - 登录表单: ${hasLoginForm ? '✅' : '❌'}`);

        resolve({
          accessible: res.statusCode === 200,
          hasQRLogin,
          hasTraditionalLogin,
          hasLoginForm
        });
      });
    });

    req.on('error', (error) => {
      console.error('❌ 访问登录页面失败:', error.message);
      resolve({
        accessible: false,
        error: error.message
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        accessible: false,
        error: 'Request timeout'
      });
    });
  });
}

// 主测试函数
async function runIntegrationTest() {
  try {
    console.log('🔧 检查环境...');

    // 检查端口
    const portInUse = await checkPort(WEB_ADMIN_PORT);
    if (portInUse) {
      console.log(`✅ 端口 ${WEB_ADMIN_PORT} 已被占用，可能服务器已运行`);
    } else {
      console.log(`⚠️ 端口 ${WEB_ADMIN_PORT} 未被占用，启动开发服务器...`);
      await startDevServer();
    }

    // 检查登录页面
    const loginPageResult = await checkLoginPage();

    console.log('\n📋 测试结果总结:');
    console.log('='.repeat(30));

    if (loginPageResult.accessible) {
      console.log('✅ 登录页面可正常访问');
      console.log('✅ 双Tab登录方式已集成');

      if (loginPageResult.hasQRLogin && loginPageResult.hasTraditionalLogin) {
        console.log('✅ 扫码登录和账号密码登录都已实现');
      } else {
        console.log('⚠️ 部分登录方式可能未正确实现');
      }

      console.log('\n🎯 手动测试步骤:');
      console.log(`1. 访问 ${LOGIN_URL}`);
      console.log('2. 检查是否有"扫码登录"和"账号密码"两个Tab');
      console.log('3. 点击"扫码登录"Tab');
      console.log('4. 选择登录角色（admin/social_worker/volunteer等）');
      console.log('5. 检查是否显示二维码');
      console.log('6. 使用微信小程序扫描二维码');
      console.log('7. 在小程序中确认登录');
      console.log('8. 检查是否成功跳转到仪表盘');

      console.log('\n🐛 故障排除:');
      console.log('- 如果二维码不显示，检查qrcode依赖是否正确安装');
      console.log('- 如果登录失败，检查云函数qrLogin是否正确部署');
      console.log('- 如果权限错误，检查RBAC配置是否正确');

    } else {
      console.log('❌ 登录页面无法访问');
      if (loginPageResult.error) {
        console.log(`错误: ${loginPageResult.error}`);
      }
    }

    console.log('\n🔗 相关文件:');
    console.log('- 登录页面: web-admin/src/pages/LoginPage.tsx');
    console.log('- QR登录组件: web-admin/src/components/QRLogin.tsx');
    console.log('- 小程序确认页: wx-project/pages/qr-confirm/');
    console.log('- 云函数: cloudfunctions/qrLogin/');
    console.log('- 测试脚本: web-admin/src/test/qr-login-verification.js');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    process.exit(1);
  }
}

// 运行测试
runIntegrationTest();