# 技术方案设计

## 概述

为 `tcb pull` 命令增加 cnb.cool 仓库的支持，使开发者能够直接从 cnb.cool 平台拉取项目模板。

## 技术架构

### 当前架构分析

`tcb pull` 命令基于 `TemplateManager` 类实现，支持：

- 内置模板下载（ZIP 文件）
- Git 仓库克隆（GitHub, Gitee, SSH）

### 新增功能架构

```
TemplateManager
├── isGitUrl()           # 新增 cnb.cool URL 识别
├── parseGitUrl()        # 新增 cnb.cool URL 解析
├── buildGitUrl()        # 新增 cnb.cool Git URL 构建
└── downloadGitTemplateToTemp()  # 复用现有 Git 下载逻辑
```

## 技术选型

### URL 格式识别

- 使用正则表达式匹配 cnb.cool URL 格式
- 支持 HTTP 和 HTTPS 协议
- 支持带分支和子目录的 URL

### URL 解析逻辑

- 解析格式：`https://cnb.cool/{owner}/{repo}[/tree/{branch}[/{subpath}]]`
- 默认分支：main（与 GitHub 保持一致）
- 支持子目录拉取

### Git URL 构建

- 构建格式：`https://cnb.cool/{owner}/{repo}.git`
- 复用现有的 Git 克隆逻辑

## 实现细节

### 1. 接口扩展

```typescript
interface GitUrlInfo {
    platform: 'github' | 'gitee' | 'git' | 'cnb' // 新增 'cnb'
    owner: string
    repo: string
    branch: string
    subpath?: string
}
```

### 2. URL 解析实现

```typescript
// 新增 cnb.cool URL 解析
const cnbMatch = url.match(/https?:\/\/cnb\.cool\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+)\/(.+))?/)
if (cnbMatch) {
    return {
        platform: 'cnb',
        owner: cnbMatch[1],
        repo: cnbMatch[2],
        branch: cnbMatch[3] || 'main',
        subpath: cnbMatch[4]
    }
}
```

### 3. Git URL 构建

```typescript
if (gitInfo.platform === 'cnb') {
    return `https://cnb.cool/${gitInfo.owner}/${gitInfo.repo}.git`
}
```

## 安全考虑

### URL 验证

- 严格的正则表达式匹配，确保只识别合法的 cnb.cool URL
- 防止恶意 URL 注入

### 网络安全

- 复用现有的 Git 克隆安全机制
- 支持 HTTPS 协议，确保传输安全

## 兼容性

### 向后兼容

- 不影响现有的 GitHub/Gitee/SSH 支持
- 保持现有的 API 接口不变

### 前向兼容

- 支持 cnb.cool 的未来 URL 格式变更
- 预留扩展空间

## 测试策略

### 单元测试

- URL 解析测试（基础 URL、带分支、带子目录）
- URL 验证测试
- Git URL 构建测试

### 集成测试

- 实际 cnb.cool 仓库拉取测试
- 错误处理测试

## 部署策略

### 渐进式部署

1. 代码合并到主分支
2. 在测试环境验证功能
3. 生产环境灰度发布
4. 全量发布

### 回滚策略

- 代码层面：可通过条件编译回滚
- 配置层面：可通过配置开关控制

## 监控和运维

### 错误监控

- 记录 cnb.cool 拉取失败的错误信息
- 监控 URL 解析失败的情况

### 性能监控

- 监控 cnb.cool 仓库的拉取时间
- 监控网络请求的成功率
