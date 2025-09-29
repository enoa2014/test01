# 实施计划

- [x] 1. 创建 cloudbase-mcp bin 文件
  - 在 `bin/` 目录下创建 `cloudbase-mcp.js` 文件
  - 实现直接调用内置 `@cloudbase/cloudbase-mcp` 包的逻辑
  - 确保文件有正确的执行权限
  - _需求: 需求 1

- [x] 2. 在 package.json 中注册新命令
  - 在 `bin` 字段中添加 `cloudbase-mcp` 命令映射
  - 确保命令指向正确的 bin 文件
  - _需求: 需求 1

- [x] 3. 实现 IDE 配置映射常量
  - 在 `router.ts` 中添加 IDE 到文件的映射关系常量
  - 参考 CloudBase-AI-ToolKit 的映射配置
  - 支持 Cursor、VSCode、Claude Code 等多种 IDE
  - _需求: 需求 3

- [x] 3.1. 扩展支持更多 IDE 和格式
  - 添加 OpenAI Codex (.codex/config.toml) 支持
  - 添加 OpenCode (.opencode.json) 支持
  - 添加 Aider (mcp.json) 支持
  - 实现 TOML 格式解析和修改功能
  - _需求: 需求 3

- [x] 4. 修改模板下载后的处理逻辑
  - 在 `downloadAndExtractTemplate` 方法中添加 MCP 配置修改逻辑
  - 实现自动检测 MCP 配置文件的功能
  - 实现将 npx 命令替换为 cloudbase-mcp 命令的功能
  - _需求: 需求 2

- [x] 5. 实现 MCP 配置文件修改函数
  - 创建 `modifyMCPConfigs` 函数
  - 遍历所有 IDE 配置文件并修改命令
  - 验证修改后的配置文件正确性
  - _需求: 需求 2

- [x] 6. 添加配置验证功能
  - 实现验证 MCP 配置文件格式的功能
  - 确保修改后的配置仍然有效
  - 添加错误处理和回滚机制
  - _需求: 需求 2

- [x] 7. 测试验证
  - 测试 cloudbase-mcp 命令是否正常工作
  - 测试模板下载和配置修改功能
  - 测试不同 IDE 配置文件的生成
  - _需求: 需求 1, 需求 2, 需求 3

- [x] 8. 文档更新
  - 更新 README.md 说明新的 cloudbase-mcp 命令
  - 更新模板下载相关的文档
  - _需求: 需求 1, 需求 2 