#!/usr/bin/env node

const path = require('path');
const fs = require('fs-extra');

// 模拟 Logger
const mockLogger = {
    info: (...args) => console.log('ℹ️', ...args),
    warn: (...args) => console.log('⚠️', ...args),
    error: (...args) => console.log('❌', ...args),
    debug: (...args) => console.log('🔍', ...args),
    log: (...args) => console.log(...args)
};

async function testMCPIntegration() {
    console.log('🧪 测试 MCP 配置修改功能...\n');
    
    try {
        // 动态导入 MCPConfigModifier
        const { MCPConfigModifier } = await import('./lib/utils/mcp-config-modifier.js');
        
        const mcpConfigModifier = new MCPConfigModifier();
        const testDir = path.join(__dirname, 'test-demo');
        
        console.log(`📁 测试目录: ${testDir}`);
        
        // 检查测试文件是否存在
        const files = [
            '.cursor/mcp.json',
            '.vscode/mcp.json',
            '.codex/config.toml'
        ];
        
        console.log('\n📋 测试前的文件内容:');
        for (const file of files) {
            const filePath = path.join(testDir, file);
            if (await fs.pathExists(filePath)) {
                const content = await fs.readFile(filePath, 'utf-8');
                console.log(`\n${file}:`);
                console.log(content);
            }
        }
        
        // 执行 MCP 配置修改
        console.log('\n🔧 执行 MCP 配置修改...');
        await mcpConfigModifier.modifyMCPConfigs(testDir, mockLogger);
        
        // 检查修改后的文件
        console.log('\n📋 测试后的文件内容:');
        for (const file of files) {
            const filePath = path.join(testDir, file);
            if (await fs.pathExists(filePath)) {
                const content = await fs.readFile(filePath, 'utf-8');
                console.log(`\n${file}:`);
                console.log(content);
            }
        }
        
        console.log('\n✅ MCP 配置修改测试完成！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    }
}

// 运行测试
testMCPIntegration();
