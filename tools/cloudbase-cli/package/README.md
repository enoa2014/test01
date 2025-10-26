# CloudBase 命令行工具 ![npm (tag)](https://img.shields.io/npm/v/@cloudbase/cli)

CloudBase CLI 是一个开源的命令行界面交互工具，用于帮助用户快速、方便的部署项目，管理云开发资源。

## 主要功能

- **云开发资源管理**：快速部署项目，管理云函数、数据库、存储等资源
- **AI 开发助手**：集成多种 AI 工具（Claude、Qwen、Codex、Aider 等），提升开发效率
- **MCP 协议支持**：内置 `cloudbase-mcp` 命令，支持 Model Context Protocol，无需额外安装
- **模板下载**：提供多种项目模板，自动配置 IDE 和 MCP 环境

## 安装 CloudBase CLI

### npm

```shell
npm install -g @cloudbase/cli
```

### yarn

```shell
yarn global add @cloudbase/cli
```

安装完成后，你可以使用 `cloudbase -v` 验证是否安装成功，如果输出了类似下面的版本号，则表明 CloudBase CLI 被成功安装到您的计算机中。

```text
2.7.8
```

## 可用命令

- `cloudbase` 或 `tcb`：主要的 CLI 命令
- `cloudbase-mcp`：内置的 MCP 服务器命令，支持 Model Context Protocol

## CloudBase CLI 运行要求

**Node.js 8.6.0+**

## 文档

请访问[教程与文档](https://docs.cloudbase.net/cli/intro.html)了解详细的使用方法。

## 意见反馈

您可以到 GitHub Repo 新建一个 [issue](https://github.com/TencentCloudBase/cloudbase-cli/issues) 反馈您在使用过程中遇到的问题或建议。
