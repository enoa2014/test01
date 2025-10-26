# 技术方案设计

## 整体架构

### 核心组件

- **AICommandRouter**: 命令路由与执行引擎
- **AIConfigManager**: 配置管理与持久化
- **AISetupWizard**: 交互式配置向导
- **TemplateManager**: 模板下载与完整性校验

### 技术栈

- **语言**: TypeScript
- **CLI框架**: 基于现有 CloudBase CLI 架构
- **配置管理**: JSON + 环境变量
- **模板系统**: 远程下载 + 本地解压
- **终端美化**: figlet + gradient-string + chalk

## 命令设计

### 主命令结构

```bash
tcb ai [options] -- [agent-args]
```

### 核心选项

- `-a, --agent <name>`: 指定 AI 工具 (claude/codex/gemini)
- `-e, --envId <id>`: 云开发环境 ID
- `--setup`: 启动配置向导
- `--config`: 显示当前配置
- `--reset`: 重置配置

### 参数透传机制

- 使用 `--` 分隔符实现参数透传
- 支持所有 agent CLI 原生参数
- 自动注入环境变量和配置

## 多 Agent 配置

### 配置结构

```json
{
    "defaultAgent": "claude",
    "agents": {
        "claude": {
            "command": "claude",
            "apiKey": "sk-xxx",
            "baseUrl": "https://api.anthropic.com",
            "model": "claude-3.5-sonnet"
        }
    }
}
```

### 协议适配

- **Anthropic协议**: 直接透传 (claude, kimi, k2)
- **OpenAI协议**: 通过 claude-code-router 转发
- **自定义协议**: 支持自定义 baseUrl 和认证

## 路由与调用

### 工具检测

- 动态检测本地安装的工具
- 提供安装指导和命令
- 支持多平台兼容性

### 环境变量注入

- 自动注入 API 密钥
- 设置基础 URL 和模型
- 传递云开发环境 ID

### claude-code-router 集成

- 自动检测和安装
- 智能配置生成
- 环境变量自动注入

## 模板完整性校验

### 校验机制

- 定义每个模板类型的必要文件列表
- 解压后自动校验关键文件
- 缺失文件时输出修复建议

### 模板类型

- **rules**: AI编辑器配置模板
- **react**: React + CloudBase 全栈应用
- **vue**: Vue + CloudBase 全栈应用
- **miniprogram**: 微信小程序 + 云开发
- **uniapp**: UniApp + CloudBase 跨端应用

## 终端输出美观

### ASCII 艺术横幅

- 使用 `figlet` 库生成 "CloudBase AI ToolKit" 艺术字体
- 采用 "Slant" 字体样式，支持多行布局
- 自动适配终端宽度，避免显示溢出

### 渐变色彩效果

- 使用 `gradient-string` 库实现渐变色彩
- 色彩方案：青色 → 深蓝 → 绿色渐变
- 支持多行文本的渐变效果

### 实现细节

```typescript
async function showBanner() {
    try {
        const data = await promisify(figlet.text)(
            `CloudBase
AI ToolKit`,
            {
                font: 'Slant',
                horizontalLayout: 'fitted',
                verticalLayout: 'fitted'
            }
        )
        console.log(
            chalk.bold(
                gradient(['cyan', 'rgb(0, 111, 150)', 'rgb(0, 246,136)']).multiline(data + '\n')
            )
        )
    } catch (e) {
        // 降级到简单横幅
        console.log(chalk.bold.cyanBright('⛰︎ CloudBase AI ToolKit CLI'))
    }
}
```

### 多终端兼容性

- **支持终端**: iTerm2, Terminal.app, Windows Terminal, Git Bash
- **降级处理**: 当 figlet 不可用时使用简单横幅
- **色彩适配**: 自动检测终端色彩支持能力
- **Unicode 支持**: 使用 emoji 和特殊字符增强视觉效果

### 交互体验优化

- **状态指示**: 使用 emoji 和颜色区分不同状态
- **进度反馈**: 实时显示下载和安装进度
- **错误处理**: 友好的错误信息和解决建议
- **帮助提示**: 上下文相关的操作指导

## 用户体验

### 交互式配置

- 使用 inquirer 提供友好的交互界面
- 支持配置验证和错误提示
- 提供默认值和快速配置选项

### 错误处理

- 详细的错误信息和解决建议
- 支持配置重置和重新初始化
- 网络异常时的重试机制

### 帮助系统

- 内置命令帮助和示例
- 上下文相关的提示信息
- 链接到官方文档和资源

## 安全性

### 配置安全

- API 密钥本地加密存储
- 环境变量安全注入
- 配置文件权限控制

### 网络安全

- HTTPS 下载模板
- 证书验证
- 代理支持

## 测试策略

### 单元测试

- 配置管理测试
- 命令解析测试
- 模板校验测试

### 集成测试

- 端到端工作流测试
- 多平台兼容性测试
- 错误场景测试

### 用户体验测试

- 终端输出效果测试
- 交互流程测试
- 性能基准测试
