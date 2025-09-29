# 实施计划

## 阶段一：代码重构和提取

- [x] 1. 提取 MCP 配置修改逻辑
  - 从 `src/utils/ai/router.ts` 中提取 `modifyMCPConfigs` 相关方法
  - 创建独立的 `MCPConfigModifier` 工具类
  - 提取 IDE 配置文件映射常量
  - 提取配置文件格式推断逻辑
  - _需求: 需求 1, 需求 2

- [x] 2. 创建 MCPConfigModifier 类
  - 实现 `modifyMCPConfigs` 主方法
  - 实现 `modifyMCPJsonFile` 方法
  - 实现 `modifyMCPTomlFile` 方法
  - 实现 `objectToToml` 辅助方法
  - 添加完整的错误处理和日志记录
  - _需求: 需求 1, 需求 2

- [x] 3. 提取共享常量和类型
  - 将 `IDE_FILE_MAPPINGS` 常量移动到共享位置
  - 将 `IdeFileDescriptor` 接口移动到共享位置
  - 将 `inferConfigFormat` 函数移动到共享位置
  - 确保类型定义的一致性
  - _需求: 需求 2

## 阶段二：TemplateManager 集成

- [x] 4. 修改 TemplateManager 类
  - 在 `TemplateManager` 构造函数中初始化 `MCPConfigModifier`
  - 在 `copyFromTempToTarget` 方法完成后调用 MCP 配置修改
  - 添加错误处理，确保 MCP 配置修改失败不影响模板下载
  - 添加相应的日志记录
  - _需求: 需求 1, 需求 4

- [x] 5. 集成点优化
  - 确保 MCP 配置修改在正确的时机执行
  - 优化执行顺序，避免重复文件操作
  - 添加性能监控和日志记录
  - 支持可选的 MCP 配置修改跳过
  - _需求: 需求 1, 需求 4

## 阶段三：测试和验证

- [x] 6. 单元测试编写
  - 为 `MCPConfigModifier` 类编写单元测试
  - 测试 JSON 配置文件修改逻辑
  - 测试 TOML 配置文件修改逻辑
  - 测试错误处理机制
  - 测试边界情况
  - _需求: 需求 1, 需求 2

- [x] 7. 集成测试编写
  - 测试 `tcb pull` 命令的完整流程
  - 测试内置模板的 MCP 配置修改
  - 测试 Git 仓库的 MCP 配置修改
  - 测试 Git 子目录的 MCP 配置修改
  - 测试与现有功能的兼容性
  - _需求: 需求 1, 需求 3

- [x] 8. 端到端测试
  - 测试完整的模板下载和配置修改流程
  - 测试不同 IDE 配置文件的生成和修改
  - 测试错误场景的处理和恢复
  - 测试性能影响和资源使用
  - _需求: 需求 1, 需求 2, 需求 3

## 阶段四：文档和优化

- [ ] 9. 文档更新
  - 更新 `docs/template-pull.md` 文档
  - 添加 MCP 配置修改功能的说明
  - 更新命令使用示例
  - 添加故障排除指南
  - _需求: 需求 1, 需求 2

- [ ] 10. 代码优化
  - 优化文件遍历和修改逻辑
  - 减少重复的文件系统操作
  - 优化内存使用和性能
  - 添加配置选项和开关
  - _需求: 需求 4

## 阶段五：发布和部署

- [ ] 11. 代码审查
  - 确保代码质量和一致性
  - 验证与现有架构的兼容性
  - 检查安全性和性能影响
  - 确保测试覆盖率
  - _需求: 所有需求

- [ ] 12. 发布准备
  - 更新版本号和变更日志
  - 准备发布说明
  - 验证所有功能正常工作
  - 准备回滚计划
  - _需求: 所有需求

## 验收标准检查

### 需求 1 - tcb pull 命令集成 MCP 配置修改
- [x] When 使用 `tcb pull` 命令下载模板完成后，the 系统 shall 自动检测并修改所有 MCP 配置文件
- [x] When 发现 `.cursor/mcp.json` 等配置文件时，the 系统 shall 将 `npx npm-global-exec@latest @cloudbase/cloudbase-mcp@latest` 替换为 `cloudbase-mcp`
- [x] When 修改完成后，the 系统 shall 验证配置文件的正确性
- [x] When 用户使用 `tcb pull` 下载的模板时，the MCP 功能 shall 无需额外安装即可正常工作

### 需求 2 - 保持与 tcb ai 命令的一致性
- [x] When 使用 `tcb pull` 下载模板时，the MCP 配置修改逻辑 shall 与 `tcb ai` 命令完全一致
- [x] When 支持相同的 IDE 配置文件格式时，the 系统 shall 使用相同的修改规则
- [x] When 处理 JSON 和 TOML 格式时，the 系统 shall 使用相同的转换逻辑
- [x] When 出现错误时，the 系统 shall 提供相同的错误处理和日志记录

### 需求 3 - 支持所有内置模板和 Git 仓库
- [x] When 下载内置模板（miniprogram、react、vue、uniapp、rules）时，the 系统 shall 自动修改 MCP 配置
- [x] When 从 Git 仓库下载模板时，the 系统 shall 自动修改 MCP 配置
- [x] When 从 Git 子目录下载内容时，the 系统 shall 自动修改 MCP 配置
- [x] When 支持多种 IDE 配置时，the 系统 shall 处理所有相关的配置文件

### 需求 4 - 向后兼容性
- [x] When 现有 `tcb pull` 命令功能使用时，the 系统 shall 保持原有行为不变
- [x] When 新增 MCP 配置修改功能时，the 系统 shall 不影响模板下载的核心流程
- [x] When 出现 MCP 配置修改失败时，the 系统 shall 不影响模板下载的成功完成
- [x] When 用户可以选择跳过 MCP 配置修改时，the 系统 shall 提供相应的选项

