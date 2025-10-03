# 需求文档

## 介绍

为 `tcb pull` 命令增加 cnb.cool 仓库的支持，使开发者能够直接从 cnb.cool 平台拉取项目模板。

## 需求

### 需求 1 - 支持 cnb.cool URL 解析

**用户故事：** 作为开发者，我希望能够通过 `tcb pull https://cnb.cool/username/repo` 直接拉取 cnb.cool 上的项目模板。

#### 验收标准

1. When 用户输入 `tcb pull https://cnb.cool/username/repo`，the tcb pull 命令 shall 识别出这是一个 cnb.cool URL 并进行相应处理。
2. When 用户输入 `tcb pull https://cnb.cool/username/repo/tree/branch/path`，the tcb pull 命令 shall 支持拉取 cnb.cool 仓库的指定分支和子目录。
3. When 用户输入无效的 cnb.cool URL，the tcb pull 命令 shall 显示清晰的错误提示信息。

### 需求 2 - cnb.cool 仓库拉取功能

**用户故事：** 作为开发者，我希望 `tcb pull` 命令能够成功拉取 cnb.cool 上的项目模板到本地。

#### 验收标准

1. When 用户执行 `tcb pull https://cnb.cool/username/repo`，the 系统 shall 成功下载并解压 cnb.cool 上的仓库内容。
2. When 用户指定输出目录时，the 系统 shall 将模板内容保存到指定的目录中。
3. When 拉取过程中发生错误，the 系统 shall 显示详细的错误信息并提供可能的解决方案。

### 需求 3 - 命令帮助更新

**用户故事：** 作为开发者，我希望在 `tcb pull` 命令的帮助信息中看到 cnb.cool 的使用说明。

#### 验收标准

1. When 用户执行 `tcb pull --help`，the 帮助信息 shall 包含 cnb.cool 的支持说明和示例。
2. When 用户执行 `tcb pull list`，the 模板列表 shall 包含 cnb.cool 的支持格式说明。

## 示例

```bash
# 拉取 cnb.cool 上的项目
tcb pull https://cnb.cool/tencent/cloud/cloudbase/CloudBase-AI-ToolKit

# 拉取指定分支和子目录
tcb pull https://cnb.cool/shuishenhuole/learning/tree/main/examples

# 指定输出目录
tcb pull https://cnb.cool/username/repo --output ./my-project
```
