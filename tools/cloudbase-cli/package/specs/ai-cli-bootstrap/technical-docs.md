# AI 开发套件

AI 开发套件是云开发为用户提供的 AI 辅助开发能力，用户可以通过云开发提供的 CLI 工具快速启动和配置主流 AI 编程工具，如 Claude Code、OpenAI Codex、Gemini CLI 等。AI 开发套件内置云开发全栈能力，支持生成、部署和托管全栈 Web 应用与小程序、数据库和后端服务。

## 命令总览

```bash
tcb ai [options] -- [agent-args]
```

## 路径说明

* `options` 为 AI 开发套件的配置选项，如 `-a claude`、`-e my-env` 等。
* `agent-args` 为目标 AI CLI 工具的原生参数，通过 `--` 分隔符透传。

⚠️ 注意事项

* `--` 分隔符后的所有参数将原样传递给目标 AI CLI 工具，请确保参数格式正确。
* 首次使用需要运行 `tcb ai --setup` 进行配置。
* 确保已安装目标 AI CLI 工具，如 Claude Code、OpenAI CLI 等。

## 快速开始

### 1. 配置 AI 开发套件

首次使用需要配置 AI 开发套件：

```bash
# 启动配置向导
tcb ai --setup
```

配置向导将引导您：
- 选择默认的 AI 工具（Claude Code、OpenAI Codex、Gemini CLI）
- 配置 API 密钥和基础 URL
- 设置云开发环境 ID
- 选择模型和协议类型

### 2. 启动 AI 工具

配置完成后，可以直接启动 AI 工具：

```bash
# 使用默认配置启动 Claude Code
tcb ai -a claude -- --continue

# 指定环境 ID 启动
tcb ai -a claude -e my-env -- --model=claude-3.5-sonnet

# 查看帮助信息
tcb ai -a claude -- --help
```

## 核心功能

### 启动 AI 工具

您可以使用下面的命令启动配置好的 AI 工具：

```bash
tcb ai -a <agent> [options] -- [agent-args]
```

**参数说明：**
- `-a, --agent <name>`: 指定 AI 工具名称（claude/codex/gemini）
- `-e, --envId <id>`: 指定云开发环境 ID
- `--`: 参数分隔符，后面的参数将透传给 AI 工具

**使用示例：**
```bash
# 启动 Claude Code 并继续上次会话
tcb ai -a claude -- --continue

# 启动 OpenAI Codex 并指定模型
tcb ai -a codex -- --model=gpt-4

# 启动 Gemini CLI 并设置最大 token
tcb ai -a gemini -- --max-tokens=4096
```

### 配置管理

#### 查看当前配置

```bash
tcb ai --config
```

显示当前配置信息，包括：
- 默认 AI 工具
- API 密钥状态
- 环境 ID 配置
- 模型和协议设置

#### 重置配置

```bash
tcb ai --reset
```

清除所有配置信息，恢复到初始状态。

#### 交互式配置

```bash
tcb ai --setup
```

启动交互式配置向导，引导您完成：
- AI 工具选择和配置
- API 密钥设置
- 云开发环境绑定
- 协议和模型选择

## 支持的 AI 工具

### Claude Code

Claude Code 是 Anthropic 推出的 AI 编程助手，支持自然语言编程和代码生成。

**安装命令：**
```bash
npm install -g @anthropic-ai/claude-code
```

**配置要求：**
- API 密钥：`ANTHROPIC_API_KEY`
- 基础 URL：`https://api.anthropic.com`
- 支持模型：claude-3.5-sonnet, claude-3-opus 等

**使用示例：**
```bash
# 启动 Claude Code
tcb ai -a claude -- --continue

# 指定模型和参数
tcb ai -a claude -- --model=claude-3.5-sonnet --max-tokens=4096
```

### OpenAI Codex

OpenAI Codex 是 OpenAI 的代码生成 AI，基于 GPT 模型优化。

**安装命令：**
```bash
npm install -g openai
```

**配置要求：**
- API 密钥：`OPENAI_API_KEY`
- 基础 URL：`https://api.openai.com`
- 支持模型：gpt-4, gpt-3.5-turbo 等

**使用示例：**
```bash
# 启动 OpenAI Codex
tcb ai -a codex -- --model=gpt-4

# 设置温度和最大 token
tcb ai -a codex -- --temperature=0.7 --max-tokens=2048
```

### Gemini CLI

Gemini CLI 是 Google 的 AI 编程工具，基于 Gemini 模型。

**安装命令：**
```bash
npm install -g @google/generative-ai
```

**配置要求：**
- API 密钥：`GOOGLE_API_KEY`
- 基础 URL：`https://generativelanguage.googleapis.com`
- 支持模型：gemini-2.0-flash, gemini-2.0-pro 等

**使用示例：**
```bash
# 启动 Gemini CLI
tcb ai -a gemini -- --model=gemini-2.0-pro

# 设置安全过滤
tcb ai -a gemini -- --safety-level=BLOCK_MEDIUM_AND_ABOVE
```

## 协议适配

### Anthropic 协议

支持 Anthropic 协议的 AI 工具可以直接透传：

```bash
# Claude Code（原生支持）
tcb ai -a claude -- --continue

# Kimi（支持 Anthropic 协议）
tcb ai -a kimi -- --model=claude-3.5-sonnet

# K2（支持 Anthropic 协议）
tcb ai -a k2 -- --max-tokens=4096
```

### OpenAI 协议

支持 OpenAI 协议的 AI 工具通过 claude-code-router 转发：

```bash
# 自动检测并安装 claude-code-router
tcb ai -a openai -- --model=gpt-4

# 自定义 OpenAI 兼容服务
tcb ai -a custom -- --base-url=https://api.example.com
```

## 云开发集成

### 环境变量注入

AI 开发套件会自动注入云开发相关环境变量：

```bash
# 自动注入环境 ID
tcb ai -a claude -e my-env -- --continue

# 环境变量示例
CLOUDBASE_ENV_ID=my-env
CLOUDBASE_REGION=ap-shanghai
```

### 模板下载

支持下载云开发项目模板：

```bash
# 下载 React + CloudBase 模板
tcb ai --template react

# 下载小程序模板
tcb ai --template miniprogram

# 下载 Vue + CloudBase 模板
tcb ai --template vue
```

**支持的模板类型：**
- `rules`: AI 编辑器配置模板
- `react`: React + CloudBase 全栈应用
- `vue`: Vue + CloudBase 全栈应用
- `miniprogram`: 微信小程序 + 云开发
- `uniapp`: UniApp + CloudBase 跨端应用

### 自动部署

AI 工具生成的代码可以直接部署到云开发：

```bash
# 生成并部署 React 应用
tcb ai -a claude -e my-env -- --prompt="创建一个 React 购物车应用"

# 部署到云函数
tcb ai -a claude -e my-env -- --prompt="创建一个用户注册云函数"
```

## 高级配置

### 自定义 Provider

支持配置自定义 AI 服务提供商：

```json
{
  "defaultAgent": "custom",
  "agents": {
    "custom": {
      "command": "claude",
      "apiKey": "sk-xxx",
      "baseUrl": "https://api.custom-ai.com",
      "model": "custom-model"
    }
  }
}
```

### 多环境支持

支持配置多个云开发环境：

```bash
# 开发环境
tcb ai -a claude -e dev-env -- --continue

# 生产环境
tcb ai -a claude -e prod-env -- --continue
```

### 代理配置

支持通过代理访问 AI 服务：

```bash
# 设置代理
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890

# 启动 AI 工具
tcb ai -a claude -- --continue
```

## 故障排除

### 常见问题

#### 1. AI 工具未安装

**错误信息：** `⚠️ claude 工具未安装`

**解决方案：**
```bash
# 安装 Claude Code
npm install -g @anthropic-ai/claude-code

# 检查安装
claude doctor
```

#### 2. API 密钥无效

**错误信息：** `❌ API 密钥无效`

**解决方案：**
```bash
# 重新配置
tcb ai --setup

# 检查 API 密钥格式
# Claude: sk-ant-api03-xxx
# OpenAI: sk-xxx
# Google: AIzaSyCxxx
```

#### 3. 网络连接问题

**错误信息：** `❌ 网络连接失败`

**解决方案：**
```bash
# 检查网络连接
ping api.anthropic.com

# 配置代理
export HTTP_PROXY=http://127.0.0.1:7890

# 使用国内镜像（如果支持）
tcb ai -a claude -- --base-url=https://api.anthropic.cn
```

#### 4. 模板下载失败

**错误信息：** `❌ 模板下载失败`

**解决方案：**
```bash
# 检查网络连接
curl -I https://static.cloudbase.net

# 重新下载
tcb ai --template react --force

# 手动下载模板
wget https://static.cloudbase.net/cloudbase-examples/web-cloudbase-react-template.zip
```

### 调试模式

启用调试模式获取详细信息：

```bash
# 启用调试
DEBUG=* tcb ai -a claude -- --continue

# 查看详细日志
tcb ai -a claude -- --verbose --continue
```

## 最佳实践

### 1. 配置管理

- 使用 `tcb ai --setup` 进行初始配置
- 定期更新 API 密钥
- 为不同项目使用不同的环境 ID

### 2. 安全考虑

- 不要在代码中硬编码 API 密钥
- 使用环境变量存储敏感信息
- 定期轮换 API 密钥

### 3. 性能优化

- 选择合适的模型和参数
- 使用 `--continue` 保持会话连续性
- 合理设置 `max-tokens` 参数

### 4. 云开发集成

- 充分利用云开发的全栈能力
- 使用模板快速搭建项目
- 结合云函数和数据库构建完整应用

## 相关资源

- [CloudBase CLI 官方文档](https://docs.cloudbase.net/cli-v1/)
- [Claude Code 官方文档](https://docs.anthropic.com/en/docs/claude-code)
- [OpenAI API 文档](https://platform.openai.com/docs)
- [Google AI Studio](https://aistudio.google.com/)
- [云开发社区](https://cloudbase.net/community)

---

上一页[云存储](./storage) 下一页[静态网站托管](./hosting) 