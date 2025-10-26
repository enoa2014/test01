/**
 * 带身份验证的二维码生成测试
 */

const http = require('http');

function makeRequest(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: result
                    });
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: body
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function testWithAuthentication() {
    console.log('=== 带身份验证的二维码生成测试 ===\n');

    const baseUrl = 'http://localhost:4173';

    // 测试1: 基础二维码生成测试（不需要身份验证）
    console.log('🧪 测试1: 基础二维码生成');
    try {
        const options = {
            hostname: 'localhost',
            port: 4173,
            path: '/api/func/testQrGeneration',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const data = { data: { testType: 'basic' } };
        const result = await makeRequest(options, data);

        console.log(`状态码: ${result.statusCode}`);
        console.log('响应内容:', JSON.stringify(result.body, null, 2));

        if (result.body && result.body.success) {
            console.log('✅ 基础二维码生成测试成功');
            console.log(`文件ID: ${result.body.fileID}`);
            console.log(`临时链接: ${result.body.tempURL}`);
        } else {
            console.log('❌ 基础二维码生成测试失败');
            console.log(`错误: ${result.body?.error || result.body?.message || '未知错误'}`);
        }
    } catch (error) {
        console.log('❌ 网络请求失败:', error.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 测试2: 完整流程测试（不需要身份验证）
    console.log('🧪 测试2: 完整流程测试');
    try {
        const options = {
            hostname: 'localhost',
            port: 4173,
            path: '/api/func/testQrGeneration',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const data = { data: { testType: 'full' } };
        const result = await makeRequest(options, data);

        console.log(`状态码: ${result.statusCode}`);
        console.log('响应内容:', JSON.stringify(result.body, null, 2));

        if (result.body && result.body.success) {
            console.log('✅ 完整流程测试成功');
            console.log(`邀请码: ${result.body.code}`);
            console.log(`邀请ID: ${result.body.inviteId}`);
            console.log(`文件ID: ${result.body.fileId}`);
            console.log(`临时链接: ${result.body.url}`);
        } else {
            console.log('❌ 完整流程测试失败');
            console.log(`错误: ${result.body?.error || result.body?.message || '未知错误'}`);
        }
    } catch (error) {
        console.log('❌ 网络请求失败:', error.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 测试3: 测试微信开发者工具中的直接云函数调用
    console.log('🧪 测试3: 直接调用微信云函数（模拟微信开发者工具环境）');
    console.log('此测试需要通过微信开发者工具控制台执行：');
    console.log('```javascript');
    console.log('// 在微信开发者工具控制台中运行：');
    console.log('wx.cloud.callFunction({');
    console.log('  name: "testQrGeneration",');
    console.log('  data: { testType: "basic" }');
    console.log('}).then(res => {');
    console.log('  console.log("测试结果:", res);');
    console.log('}).catch(err => {');
    console.log('  console.error("测试失败:", err);');
    console.log('});');
    console.log('```');

    console.log('\n=== 测试完成 ===');
}

// 检查服务器是否运行
async function checkServer() {
    try {
        const options = {
            hostname: 'localhost',
            port: 4173,
            path: '/',
            method: 'GET'
        };

        await makeRequest(options);
        return true;
    } catch (error) {
        return false;
    }
}

async function main() {
    console.log('检查Web管理端服务器状态...');
    const serverRunning = await checkServer();

    if (!serverRunning) {
        console.log('❌ Web管理端服务器未运行');
        console.log('请先启动服务器: cd web-admin && npm run dev:all');
        return;
    }

    console.log('✅ Web管理端服务器正在运行\n');
    await testWithAuthentication();
}

main().catch(error => {
    console.error('测试过程中发生错误:', error);
});