# Context7 MCP 集成指南

本文档说明如何在本仓库中接入 Upstash Context7 作为 MCP 服务器，用于在对话中检索技术文档与代码资料。

## 前置条件
- 已安装 Node.js 18+ 与 npm
- 可访问 npm 注册表（首次通过 `npx` 拉取 Context7）
- 拥有 Context7 API Key（记为 `CONTEXT7_API_KEY`）

## 环境变量
将 API Key 写入本地环境（任选其一）：

- 方式 A：在仓库根目录的 `.env` 中新增
```
CONTEXT7_API_KEY=替换为你的实际Token
```
- 方式 B：仅当前终端会话
```
export CONTEXT7_API_KEY=你的实际Token
```

## MCP 配置文件
已为常见工具生成了三份配置（任意一种生效即可）：

- Codex CLI: `.codex/config.toml`
- VS Code (带 MCP 插件): `.vscode/mcp.json`
- Cursor / 兼容编辑器: `.cursor/mcp.json`

示例（已写入仓库）：

- `.codex/config.toml`
```
[mcp.servers.context7]
transport = "stdio"
command = "npx"
args = ["-y", "context7", "mcp"]
[mcp.servers.context7.env]
CONTEXT7_API_KEY = "${CONTEXT7_API_KEY}"
```

- `.vscode/mcp.json`
```
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "context7", "mcp"],
      "env": { "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}" }
    }
  }
}
```

> 注意：如果 `context7` 包名不可用，请改为 `@upstash/context7`：
> - `args`: ["-y", "@upstash/context7", "mcp"]

## 验证安装
首次启动时 `npx` 会拉取二进制/脚本：

```
# 验证 Context7 可用
npx -y context7 --help   # 或 npx -y @upstash/context7 --help
```

在支持 MCP 的客户端中执行“列出资源/工具”，应能看到 `context7` 服务器。

## 用法示例
- 在对话中提问：
  - “使用 context7 查找 chrome-mcp-server 相关资料”
  - “context7 搜索 Axios 错误处理最佳实践”

## 故障排查
- 报错 `unknown MCP server 'context7'`：
  - 确认工具已读取上述 MCP 配置文件
  - 重启客户端以重新载入配置
- `npx` 拉取失败：
  - 检查网络代理/镜像
  - 尝试将包名替换为 `@upstash/context7`
- 401/403：
  - 检查 `CONTEXT7_API_KEY` 是否正确，是否在当前进程可见

## 安全提示
- 请勿将 `CONTEXT7_API_KEY` 提交到仓库
- 推荐仅在本机 `.env` 或系统环境变量中配置

---
如需我代为安装并连通测试，请授权网络访问与 `npx` 执行，我将自动完成验证并展示资源列表。

