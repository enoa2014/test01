# 技术方案设计

## 架构概述

为 CloudBase CLI 添加模板拉取功能，支持多种模板来源的统一管理。

## 技术栈

- **语言**: TypeScript
- **框架**: 基于现有的 CloudBase CLI 架构
- **依赖**: 
  - `simple-git`: Git 操作
  - `fs-extra`: 文件系统操作
  - `path`: 路径处理
  - `inquirer`: 交互式提示

## 技术选型

### Git 子目录下载方案

Git 本身不支持直接下载子目录，但可以通过以下方式实现：

1. **方案一**: 使用 `git clone --filter=blob:none --sparse` 进行稀疏克隆
2. **方案二**: 克隆整个仓库后删除不需要的文件
3. **方案三**: 使用 GitHub/Gitee API 获取子目录内容

**推荐方案**: 方案一 + 方案二结合，优先使用稀疏克隆，失败时回退到完整克隆。

### 模板来源识别

```typescript
interface TemplateSource {
  type: 'builtin' | 'github' | 'gitee' | 'git';
  identifier: string;
  subpath?: string;
}
```

## 数据库/接口设计

### 内置模板映射

```typescript
const BUILTIN_TEMPLATES = {
  miniprogram: {
    url: 'https://static.cloudbase.net/cloudbase-examples/miniprogram-cloudbase-miniprogram-template.zip',
    name: '微信小程序 + CloudBase'
  },
  react: {
    url: 'https://static.cloudbase.net/cloudbase-examples/web-cloudbase-react-template.zip',
    name: 'Web 应用 - React + CloudBase'
  },
  vue: {
    url: 'https://static.cloudbase.net/cloudbase-examples/web-cloudbase-vue-template.zip',
    name: 'Web 应用 - Vue + CloudBase'
  },
  uniapp: {
    url: 'https://static.cloudbase.net/cloudbase-examples/universal-cloudbase-uniapp-template.zip',
    name: '跨端应用 - UniApp + CloudBase'
  },
  rules: {
    url: 'https://static.cloudbase.net/cloudbase-examples/web-cloudbase-project.zip',
    name: 'AI 规则和配置'
  }
}
```

### Git URL 解析

```typescript
interface GitUrlInfo {
  platform: 'github' | 'gitee' | 'git';
  owner: string;
  repo: string;
  branch: string;
  subpath?: string;
}
```

## 核心模块设计

### 1. TemplateManager 类

负责模板下载的核心逻辑：

```typescript
class TemplateManager {
  async pullTemplate(source: string, options: PullOptions): Promise<void>
  async downloadBuiltinTemplate(templateId: string, targetPath: string): Promise<void>
  async downloadGitTemplate(gitUrl: string, targetPath: string, subpath?: string): Promise<void>
  private parseGitUrl(url: string): GitUrlInfo
  private cloneWithSparse(gitUrl: string, targetPath: string, subpath: string): Promise<void>
  private cloneFull(gitUrl: string, targetPath: string): Promise<void>
}
```

### 2. AI 命令增强

修改现有的 AI 命令，添加 `--template` 参数支持。

### 3. Pull 命令实现

新增 `PullCommand` 类，支持多种模板来源。

## 测试策略

### 单元测试

1. Git URL 解析测试
2. 模板下载功能测试
3. 错误处理测试

### 集成测试

1. 完整命令执行测试
2. 网络异常处理测试
3. 文件系统操作测试

## 安全性

1. **路径验证**: 确保下载路径在安全范围内
2. **Git 操作**: 使用安全的 Git 操作，避免命令注入
3. **文件权限**: 确保下载的文件具有适当的权限

## 错误处理

1. **网络错误**: 重试机制和友好的错误提示
2. **文件系统错误**: 权限检查和清理机制
3. **Git 错误**: 详细的错误信息和回退方案

## 性能考虑

1. **稀疏克隆**: 减少网络传输和存储空间
2. **流式处理**: 大文件下载时使用流式处理
3. **缓存机制**: 避免重复下载相同模板
