# 需求文档

## 介绍

当前下载的模板中的 MCP 配置使用 `npx npm-global-exec@latest @cloudbase/cloudbase-mcp@latest` 命令，这会导致用户需要安装 MCP，降低了成功率。CLI 已经内置了 `@cloudbase/cloudbase-mcp@latest` 依赖，需要在 CLI 中直接暴露一个额外的 bin 文件指向到这个依赖，然后修改下载模板的 MCP 配置都指向这个全局命令。

## 需求

### 需求 1 - 创建全局 MCP bin 命令

**用户故事：** 作为开发者，我希望 CLI 提供一个全局的 MCP 命令，这样我就不需要额外安装 MCP 包，提高配置成功率。

#### 验收标准

1. When CLI 安装后，the 系统 shall 提供一个全局的 `cloudbase-mcp` 命令
2. When 执行 `cloudbase-mcp` 命令时，the 系统 shall 直接调用内置的 `@cloudbase/cloudbase-mcp` 包
3. When 验证 MCP 配置时，the 配置文件中的命令 shall 指向 `cloudbase-mcp` 而不是 `npx npm-global-exec@latest @cloudbase/cloudbase-mcp@latest`

### 需求 2 - 自动修改模板 MCP 配置

**用户故事：** 作为开发者，我希望下载模板后系统自动修改 MCP 配置，将 npx 命令替换为 CLI 提供的全局命令，避免额外的依赖安装。

#### 验收标准

1. When 下载模板完成后，the 系统 shall 自动检测并修改所有 MCP 配置文件
2. When 发现 `.cursor/mcp.json` 等配置文件时，the 系统 shall 将 `npx npm-global-exec@latest @cloudbase/cloudbase-mcp@latest` 替换为 `cloudbase-mcp`
3. When 修改完成后，the 系统 shall 验证配置文件的正确性
4. When 用户使用模板时，the MCP 功能 shall 无需额外安装即可正常工作

### 需求 3 - 支持多种 IDE 配置和格式

**用户故事：** 作为开发者，我希望模板支持多种 IDE 的 MCP 配置，包括不同格式（JSON、TOML）和各种工具。

#### 验收标准

1. When 下载模板时，the 系统 shall 根据 IDE 类型生成对应的配置文件
2. When 配置 Cursor 时，the 系统 shall 生成 `.cursor/mcp.json` 和 `.cursor/rules/cloudbase-rules.mdc`
3. When 配置 VSCode 时，the 系统 shall 生成 `.vscode/mcp.json` 和 `.vscode/settings.json`
4. When 配置 Claude Code 时，the 系统 shall 生成 `CLAUDE.md` 和 `.mcp.json`
5. When 配置 OpenAI Codex 时，the 系统 shall 处理 `.codex/config.toml` 文件
6. When 配置 OpenCode 时，the 系统 shall 处理 `.opencode.json` 文件
7. When 配置 Aider 时，the 系统 shall 处理 `mcp.json` 文件
8. When 处理 TOML 格式时，the 系统 shall 正确解析和修改配置
