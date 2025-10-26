/**
 * Chrome DevTools 自动化测试脚本
 * 模拟浏览器环境测试二维码生成功能
 */

const puppeteer = require('puppeteer');

async function runQrCodeTest() {
    console.log('=== Chrome DevTools 二维码生成测试 ===');

    let browser;
    try {
        // 启动浏览器
        console.log('🚀 启动Chrome浏览器...');
        browser = await puppeteer.launch({
            headless: false, // 显示浏览器界面
            defaultViewport: { width: 1280, height: 720 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // 监听控制台输出
        page.on('console', msg => {
            console.log(`[浏览器控制台] ${msg.type()}: ${msg.text()}`);
        });

        // 监听网络请求
        page.on('request', request => {
            if (request.url().includes('/api/func/') || request.url().includes('tcb-api')) {
                console.log(`[网络请求] ${request.method()} ${request.url()}`);
            }
        });

        page.on('response', response => {
            if (response.url().includes('/api/func/') || response.url().includes('tcb-api')) {
                console.log(`[网络响应] ${response.status()} ${response.url()}`);
            }
        });

        // 导航到测试页面
        console.log('📄 导航到测试页面...');
        await page.goto('http://localhost:4173/test-qr.html', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // 等待页面加载完成
        await page.waitForTimeout(2000);

        // 检查页面是否正确加载
        const pageTitle = await page.title();
        console.log(`📋 页面标题: ${pageTitle}`);

        // 测试1: 基础二维码生成测试
        console.log('\n🧪 执行基础二维码生成测试...');
        try {
            await page.click('button[onclick="testBasicQr()"]');
            console.log('✅ 已点击基础测试按钮');

            // 等待测试结果
            await page.waitForTimeout(10000);

            // 检查测试结果
            const results = await page.$eval('#results', el => el.innerText);
            console.log('📊 基础测试结果:');
            console.log(results.substring(results.lastIndexOf('开始基础二维码生成测试')));

            // 检查是否有二维码图片生成
            const qrImages = await page.$$('#qrImages img');
            if (qrImages.length > 0) {
                console.log('✅ 检测到生成的二维码图片');
                for (let i = 0; i < qrImages.length; i++) {
                    const src = await page.evaluate(el => el.src, qrImages[i]);
                    console.log(`   图片${i+1}: ${src.substring(0, 100)}...`);
                }
            }

        } catch (error) {
            console.error('❌ 基础测试执行失败:', error.message);
        }

        // 测试2: RBAC邀请码二维码测试
        console.log('\n🧪 执行RBAC邀请码二维码测试...');
        try {
            await page.click('button[onclick="testRbacQr()"]');
            console.log('✅ 已点击RBAC测试按钮');

            // 等待测试结果
            await page.waitForTimeout(15000);

            // 检查测试结果
            const results = await page.$eval('#results', el => el.innerText);
            console.log('📊 RBAC测试结果:');
            console.log(results.substring(results.lastIndexOf('开始RBAC邀请码二维码测试')));

        } catch (error) {
            console.error('❌ RBAC测试执行失败:', error.message);
        }

        // 测试3: 完整流程测试
        console.log('\n🧪 执行完整流程测试...');
        try {
            await page.click('button[onclick="testFullFlow()"]');
            console.log('✅ 已点击完整流程测试按钮');

            // 等待测试结果
            await page.waitForTimeout(15000);

            // 检查测试结果
            const results = await page.$eval('#results', el => el.innerText);
            console.log('📊 完整流程测试结果:');
            console.log(results.substring(results.lastIndexOf('开始完整流程测试')));

        } catch (error) {
            console.error('❌ 完整流程测试执行失败:', error.message);
        }

        // 截图保存测试结果
        console.log('\n📸 保存测试结果截图...');
        await page.screenshot({
            path: 'qr-test-results.png',
            fullPage: true
        });
        console.log('✅ 截图已保存为: qr-test-results.png');

        console.log('\n=== 测试完成 ===');
        console.log('💡 浏览器窗口将保持打开状态，您可以手动进行更多测试...');
        console.log('💡 按任意键关闭浏览器...');

        // 等待用户输入后关闭
        await new Promise(resolve => {
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.on('data', () => {
                process.stdin.setRawMode(false);
                process.stdin.pause();
                resolve();
            });
        });

    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
        console.error('错误详情:', error.message);
    } finally {
        if (browser) {
            await browser.close();
            console.log('🔚 浏览器已关闭');
        }
    }
}

// 检查依赖
try {
    require('puppeteer');
    runQrCodeTest();
} catch (error) {
    console.log('❌ 缺少 Puppeteer 依赖');
    console.log('📦 正在安装 Puppeteer...');

    const { spawn } = require('child_process');
    const npmInstall = spawn('npm', ['install', 'puppeteer'], {
        stdio: 'inherit',
        cwd: __dirname
    });

    npmInstall.on('close', (code) => {
        if (code === 0) {
            console.log('✅ Puppeteer 安装成功，重新运行测试...');
            runQrCodeTest();
        } else {
            console.error('❌ Puppeteer 安装失败');
            console.log('\n📋 备用测试方案:');
            console.log('1. 手动打开 Chrome 浏览器');
            console.log('2. 访问 http://localhost:4173/test-qr.html');
            console.log('3. 打开开发者工具 (F12)');
            console.log('4. 点击测试按钮查看结果');
            console.log('5. 查看 Console 和 Network 标签页的详细信息');
        }
    });
}