/**
 * 测试改进后的云函数
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

async function testImprovedFunction() {
    console.log('=== 测试改进后的云函数 ===\n');

    // 测试1: 环境测试（不调用微信API）
    console.log('🧪 测试1: 环境测试');
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

        const data = { data: { testType: 'env' } };
        const result = await makeRequest(options, data);

        console.log(`状态码: ${result.statusCode}`);
        console.log('响应内容:', JSON.stringify(result.body, null, 2));

        if (result.body && result.body.success) {
            console.log('✅ 环境测试成功');
            console.log('云环境ID:', result.body.environment.env);
            console.log('AppID:', result.body.environment.appId);
        } else {
            console.log('❌ 环境测试失败');
            console.log('错误:', result.body?.error || '未知错误');
        }
    } catch (error) {
        console.log('❌ 网络请求失败:', error.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 测试2: 基础功能测试（可能会遇到权限问题）
    console.log('🧪 测试2: 基础功能测试');
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
            console.log('✅ 基础功能测试成功');
            console.log('测试码:', result.body.testCode);
            console.log('文件ID:', result.body.fileID);
            console.log('临时链接:', result.body.tempURL);
        } else {
            console.log('❌ 基础功能测试失败');
            console.log('错误:', result.body?.error || '未知错误');
            console.log('详情:', result.body?.details || '');

            if (result.body?.details && result.body.details.includes('wxCloudApiToken')) {
                console.log('\n💡 这是微信API权限问题，解决方案:');
                console.log('1. 登录微信小程序后台 (mp.weixin.qq.com)');
                console.log('2. 进入"开发" → "开发管理" → "接口设置"');
                console.log('3. 开通"生成小程序码"接口权限');
                console.log('4. 确保小程序已发布');
            }
        }
    } catch (error) {
        console.log('❌ 网络请求失败:', error.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 测试3: 完整流程测试
    console.log('🧪 测试3: 完整流程测试');
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
            console.log('邀请码:', result.body.code);
            console.log('邀请ID:', result.body.inviteId);
            console.log('文件ID:', result.body.fileId);
            console.log('临时链接:', result.body.url);
        } else {
            console.log('❌ 完整流程测试失败');
            console.log('错误:', result.body?.error || '未知错误');
            console.log('详情:', result.body?.details || '');

            if (result.body?.inviteCreated) {
                console.log('✅ 但邀请创建成功:');
                console.log('  邀请码:', result.body.inviteCreated.code);
                console.log('  邀请ID:', result.body.inviteCreated.inviteId);
            }
        }
    } catch (error) {
        console.log('❌ 网络请求失败:', error.message);
    }

    console.log('\n=== 测试完成 ===');

    console.log('\n📋 总结:');
    console.log('如果看到"wxCloudApiToken"错误，这是微信API权限问题');
    console.log('需要在微信小程序后台开通"生成小程序码"接口权限');
    console.log('其他功能（数据库、云存储）应该正常工作');
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
    await testImprovedFunction();
}

main().catch(error => {
    console.error('测试过程中发生错误:', error);
});