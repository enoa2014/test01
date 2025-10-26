# 需求文档

## 介绍

当前 `tcb ai` 命令在下载模板时会自动修改 MCP 配置文件，将 `npx npm-global-exec@latest @cloudbase/cloudbase-mcp@latest` 命令替换为 `cloudbase-mcp`，但 `tcb pull` 命令没有实现这个功能。这导致用户使用 `tcb pull` 下载的模板中的 MCP 配置仍然使用 npx 命令，需要额外安装依赖，降低了配置成功率。

## 需求

### 需求 1 - tcb pull 命令集成 MCP 配置修改

**用户故事：** 作为开发者，我希望使用 `tcb pull` 命令下载模板后，系统能够自动修改 MCP 配置文件，将 npx 命令替换为 CLI 提供的全局命令，避免额外的依赖安装。

#### 验收标准

1. When 使用 `tcb pull` 命令下载模板完成后，the 系统 shall 自动检测并修改所有 MCP 配置文件
2. When 发现 `.cursor/mcp.json` 等配置文件时，the 系统 shall 将 `npx npm-global-exec@latest @cloudbase/cloudbase-mcp@latest` 替换为 `cloudbase-mcp`
3. When 修改完成后，the 系统 shall 验证配置文件的正确性
4. When 用户使用 `tcb pull` 下载的模板时，the MCP 功能 shall 无需额外安装即可正常工作

### 需求 2 - 保持与 tcb ai 命令的一致性

**用户故事：** 作为开发者，我希望 `tcb pull` 和 `tcb ai` 命令在模板下载和 MCP 配置修改方面保持一致的行为，避免混淆。

#### 验收标准

1. When 使用 `tcb pull` 下载模板时，the MCP 配置修改逻辑 shall 与 `tcb ai` 命令完全一致
2. When 支持相同的 IDE 配置文件格式时，the 系统 shall 使用相同的修改规则
3. When 处理 JSON 和 TOML 格式时，the 系统 shall 使用相同的转换逻辑
4. When 出现错误时，the 系统 shall 提供相同的错误处理和日志记录

### 需求 3 - 支持所有内置模板和 Git 仓库

**用户故事：** 作为开发者，我希望无论从内置模板还是 Git 仓库下载内容，`tcb pull` 命令都能正确处理 MCP 配置。

#### 验收标准

1. When 下载内置模板（miniprogram、react、vue、uniapp、rules）时，the 系统 shall 自动修改 MCP 配置
2. When 从 Git 仓库下载模板时，the 系统 shall 自动修改 MCP 配置
3. When 从 Git 子目录下载内容时，the 系统 shall 自动修改 MCP 配置
4. When 支持多种 IDE 配置时，the 系统 shall 处理所有相关的配置文件

### 需求 4 - 向后兼容性

**用户故事：** 作为开发者，我希望新功能不会影响现有的 `tcb pull` 命令功能，保持向后兼容。

#### 验收标准

1. When 现有 `tcb pull` 命令功能使用时，the 系统 shall 保持原有行为不变
2. When 新增 MCP 配置修改功能时，the 系统 shall 不影响模板下载的核心流程
3. When 出现 MCP 配置修改失败时，the 系统 shall 不影响模板下载的成功完成
4. When 用户可以选择跳过 MCP 配置修改时，the 系统 shall 提供相应的选项

## 技术约束

- 必须复用 `tcb ai` 命令中已有的 MCP 配置修改逻辑
- 必须支持 JSON 和 TOML 两种配置文件格式
- 必须支持所有已定义的 IDE 配置文件映射
- 必须保持与现有代码架构的一致性
