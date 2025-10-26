# 需求文档

## 介绍

为 CloudBase CLI 添加模板拉取功能，支持从多种来源获取项目模板，包括内置模板、Git 仓库和子目录。

## 需求

### 需求 1 - AI 命令模板标识支持

**用户故事：** 用户在使用 `tcb ai` 命令时，希望能够直接指定模板类型，避免交互式选择。

#### 验收标准

1. When 用户执行 `tcb ai --template miniprogram` 时，系统应当直接下载微信小程序模板而不进行交互式选择。
2. When 用户执行 `tcb ai --template react` 时，系统应当直接下载 React 模板。
3. When 用户执行 `tcb ai --template vue` 时，系统应当直接下载 Vue 模板。
4. When 用户执行 `tcb ai --template uniapp` 时，系统应当直接下载 UniApp 模板。
5. When 用户执行 `tcb ai --template rules` 时，系统应当只下载 AI 规则和配置。
6. When 用户未指定 `--template` 参数时，系统应当保持原有的交互式选择行为。

### 需求 2 - 新增 Pull 命令

**用户故事：** 用户希望能够通过 `tcb pull` 命令从多种来源拉取项目模板。

#### 验收标准

1. When 用户执行 `tcb pull miniprogram` 时，系统应当下载微信小程序模板。
2. When 用户执行 `tcb pull react` 时，系统应当下载 React 模板。
3. When 用户执行 `tcb pull vue` 时，系统应当下载 Vue 模板。
4. When 用户执行 `tcb pull uniapp` 时，系统应当下载 UniApp 模板。
5. When 用户执行 `tcb pull rules` 时，系统应当只下载 AI 规则和配置。

### 需求 3 - Git 仓库支持

**用户故事：** 用户希望能够从 Git 仓库拉取模板。

#### 验收标准

1. When 用户执行 `tcb pull https://github.com/user/repo` 时，系统应当克隆整个仓库到当前目录。
2. When 用户执行 `tcb pull https://gitee.com/user/repo` 时，系统应当克隆整个仓库到当前目录。
3. When 用户执行 `tcb pull git@github.com:user/repo.git` 时，系统应当克隆整个仓库到当前目录。

### 需求 4 - Git 子目录支持

**用户故事：** 用户希望能够从 Git 仓库的特定子目录拉取内容。

#### 验收标准

1. When 用户执行 `tcb pull https://github.com/TencentCloudBase/awesome-cloudbase-examples/tree/master/web/overcooked-game` 时，系统应当只下载该子目录的内容。
2. When 用户执行 `tcb pull https://github.com/user/repo/tree/main/src/templates` 时，系统应当只下载该子目录的内容。
3. When 用户执行 `tcb pull https://gitee.com/user/repo/tree/master/examples` 时，系统应当只下载该子目录的内容。

### 需求 5 - 目标目录指定

**用户故事：** 用户希望能够指定模板下载的目标目录。

#### 验收标准

1. When 用户执行 `tcb pull miniprogram --output ./my-project` 时，系统应当将模板下载到 `./my-project` 目录。
2. When 用户执行 `tcb pull https://github.com/user/repo --output ./custom-template` 时，系统应当将仓库内容下载到 `./custom-template` 目录。
3. When 用户未指定 `--output` 参数时，系统应当下载到当前目录。

### 需求 6 - 错误处理

**用户故事：** 系统应当优雅地处理各种错误情况。

#### 验收标准

1. When Git 仓库不存在时，系统应当显示清晰的错误信息。
2. When 网络连接失败时，系统应当显示网络错误信息。
3. When 目标目录已存在且不为空时，系统应当询问用户是否覆盖。
4. When Git 子目录路径无效时，系统应当显示路径错误信息。
