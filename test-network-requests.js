/**
 * 网络请求测试工具
 * 直接测试云函数API调用
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

async function testCloudFunctions() {
    console.log('=== 云函数网络请求测试 ===\n');

    const baseUrl = 'http://localhost:4173';

    // 测试1: 基础二维码生成测试
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

        if (result.body.success) {
            console.log('✅ 基础二维码生成测试成功');
            console.log(`文件ID: ${result.body.fileID}`);
            console.log(`临时链接: ${result.body.tempURL}`);
        } else {
            console.log('❌ 基础二维码生成测试失败');
            console.log(`错误: ${result.body.error || '未知错误'}`);
        }
    } catch (error) {
        console.log('❌ 网络请求失败:', error.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 测试2: RBAC创建邀请测试
    console.log('🧪 测试2: RBAC创建邀请');
    try {
        const options = {
            hostname: 'localhost',
            port: 4173,
            path: '/api/func/rbac',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const data = {
            data: {
                action: 'createInvite',
                role: 'volunteer',
                uses: 1,
                note: '网络请求测试'
            }
        };

        const result = await makeRequest(options, data);

        console.log(`状态码: ${result.statusCode}`);
        console.log('响应内容:', JSON.stringify(result.body, null, 2));

        if (result.body.success) {
            console.log('✅ 创建邀请成功');
            console.log(`邀请码: ${result.body.data.code}`);
            console.log(`邀请ID: ${result.body.data.inviteId}`);

            // 测试3: 生成二维码
            console.log('\n🧪 测试3: 为邀请生成二维码');
            const qrOptions = {
                hostname: 'localhost',
                port: 4173,
                path: '/api/func/rbac',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const qrData = {
                data: {
                    action: 'generateInviteQr',
                    inviteId: result.body.data.inviteId
                }
            };

            const qrResult = await makeRequest(qrOptions, qrData);

            console.log(`状态码: ${qrResult.statusCode}`);
            console.log('响应内容:', JSON.stringify(qrResult.body, null, 2));

            if (qrResult.body.success) {
                console.log('✅ 二维码生成成功');
                console.log(`文件ID: ${qrResult.body.data.fileId}`);
                console.log(`临时链接: ${qrResult.body.data.url}`);
            } else {
                console.log('❌ 二维码生成失败');
                console.log(`错误信息: ${qrResult.body.error?.message || '未知错误'}`);
                console.log(`错误代码: ${qrResult.body.error?.code || ''}`);
                console.log(`错误详情: ${qrResult.body.error?.details || ''}`);
            }
        } else {
            console.log('❌ 创建邀请失败');
            console.log(`错误信息: ${result.body.error?.message || '未知错误'}`);
        }
    } catch (error) {
        console.log('❌ 网络请求失败:', error.message);
    }

    console.log('\n=== 网络请求测试完成 ===');
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
    await testCloudFunctions();
}

main().catch(error => {
    console.error('测试过程中发生错误:', error);
});