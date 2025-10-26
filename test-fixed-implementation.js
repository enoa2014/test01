/**
 * 测试修复后的二维码生成实现
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

async function testFixedImplementation() {
    console.log('=== 测试修复后的二维码生成实现 ===\n');

    // 测试1: 环境测试
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

    console.log('\n' + '='.repeat(60) + '\n');

    // 测试2: 修复后的基础功能测试
    console.log('🧪 测试2: 修复后的基础功能测试');
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
            console.log('✅ 修复后的基础功能测试成功');
            console.log('测试码:', result.body.testCode);
            console.log('文件ID:', result.body.fileID);
            console.log('临时链接:', result.body.tempURL);
        } else {
            console.log('❌ 修复后的基础功能测试失败');
            console.log('错误:', result.body?.error || '未知错误');
            console.log('详情:', result.body?.details || '');

            // 显示修复建议
            if (result.body?.suggestions && result.body.suggestions.length > 0) {
                console.log('\n💡 修复建议:');
                result.body.suggestions.forEach((suggestion, index) => {
                    console.log(`   ${index + 1}. ${suggestion}`);
                });
            }
        }
    } catch (error) {
        console.log('❌ 网络请求失败:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 测试3: 参数组合测试
    console.log('🧪 测试3: 参数组合测试');
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

        const data = { data: { testType: 'parameters' } };
        const result = await makeRequest(options, data);

        console.log(`状态码: ${result.statusCode}`);
        console.log('响应内容:', JSON.stringify(result.body, null, 2));

        if (result.body && result.body.success) {
            console.log('✅ 参数组合测试成功');
        } else {
            console.log('❌ 参数组合测试失败');
            console.log('错误:', result.body?.error || '未知错误');
        }
    } catch (error) {
        console.log('❌ 网络请求失败:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 测试4: 完整流程测试
    console.log('🧪 测试4: 完整流程测试');
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

            if (result.body?.suggestions && result.body.suggestions.length > 0) {
                console.log('\n💡 解决建议:');
                result.body.suggestions.forEach((suggestion, index) => {
                    console.log(`   ${index + 1}. ${suggestion}`);
                });
            }
        }
    } catch (error) {
        console.log('❌ 网络请求失败:', error.message);
    }

    console.log('\n=== 修复实现测试完成 ===');

    console.log('\n📊 修复总结:');
    console.log('1. ✅ 添加了 check_path: false 参数（避免页面检查问题）');
    console.log('2. ✅ 添加了 env_version: "release" 参数（指定小程序版本）');
    console.log('3. ✅ 添加了详细的错误分析和建议');
    console.log('4. ✅ 添加了参数组合测试功能');
    console.log('5. ✅ 改进了错误处理和日志输出');

    console.log('\n🔧 如果仍然遇到 "wxCloudApiToken" 错误:');
    console.log('- 确保小程序已发布（至少体验版）');
    console.log('- 在微信小程序后台开通"生成小程序码"接口权限');
    console.log('- 检查云开发环境配置');
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
    await testFixedImplementation();
}

main().catch(error => {
    console.error('测试过程中发生错误:', error);
});