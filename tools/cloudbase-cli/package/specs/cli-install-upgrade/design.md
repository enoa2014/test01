# 技术方案设计：CloudBase CLI 安装脚本升级

## 目标与范围

- 目标：提供无需 npm/系统 Node 的一键安装体验，内置运行时，稳定、可观测，可原子升级/回滚。
- OS/ARCH：darwin x64/arm64、linux x64/arm64；Windows 暂支持 WSL/Git Bash。
- 暴露入口：`cloudbase`、`tcb`、`cloudbase-mcp`。

## 架构概览

```mermaid
flowchart TD
  subgraph Install
    A[用户运行安装脚本] --> B[检测 OS/ARCH]
    B --> C[下载 {os}/{arch} 包 + sha256]
    C --> D[解压到 ~/.local/share/cloudbase-cli/versions/<version>]
    D --> E[创建 ~/.local/bin/ 符号链接\ncloudbase | tcb | cloudbase-mcp]
    E --> F[PATH 提示]
  end

  subgraph Runtime
    F --> G[launcher 执行 ./node ./cli.js\n(webpack 单文件 bundle)]
    G --> H{入口名分发\nCLI_BIN_NAME / argv[1]}
    H --> I[CloudBase/Tcb 模块\n(CLI Core in index.js)]
    H --> J[cloudbase-mcp 模块\n(MCP Core in index.js)]
    I --> K[self-update 等子流程]
    J --> K
  end
```

## 包形态（更新）

- 压缩包：`.tar.gz`
- 目录结构：

```
<root>
├─ node / node.exe      # 内置 Node 可执行文件（Node 22）
├─ cli.js               # 主 CLI 入口（webpack 单文件 bundle）
├─ mcp.js               # cloudbase-mcp 入口（来自 @cloudbase/cloudbase-mcp/dist/cli.cjs）
├─ bin/
│  ├─ cloudbase         # 薄启动脚本（shell）
│  ├─ tcb               # 薄启动脚本（shell）
│  └─ cloudbase-mcp     # 薄启动脚本（shell）
├─ install.sh           # 便于自更新时本地调用
└─ manifest.json        # 版本与校验信息
```

- 启动脚本职责：定位自身目录，执行 `./node ./cli.js "$@"`（`cloudbase-mcp` 启动 `./node ./mcp.js`）。

## 分发与产物目录（最终，更新）

- 本地 out 目录与线上 CDN 建议结构一致：

```
out/
├─ <version>/
│  ├─ darwin/arm64/cloudbase-cli-<version>.tar.gz{,.sha256}
│  ├─ darwin/x64/cloudbase-cli-<version>.tar.gz{,.sha256}
│  ├─ linux/arm64/cloudbase-cli-<version>.tar.gz{,.sha256}
│  ├─ linux/x64/cloudbase-cli-<version>.tar.gz{,.sha256}
│  ├─ windows/arm64/cloudbase-cli-<version>.zip{,.sha256}
│  └─ windows/x64/cloudbase-cli-<version>.zip{,.sha256}
├─ install/
│  └─ install.sh                     # 安装脚本（CDN 可提供 /install → /install/install.sh 的别名）
├─ stable.txt                        # latest（stable）版本号
├─ beta.txt                          # latest（beta）版本号
├─ artifacts/                        # 本地构建缓存（CDN 可忽略）
└─ unpacked/                         # 本地展开验证（CDN 可忽略）
```

- 下载 URL：
    - `https://static.cloudbase.net/cli/<version>/{darwin|linux}/{x64|arm64}/cloudbase-cli-<version>.tar.gz`
    - `https://static.cloudbase.net/cli/<version>/windows/{x64|arm64}/cloudbase-cli-<version>.zip`
- 校验文件：对应路径追加 `.sha256`
- 安装脚本入口：`curl -fsSL https://static.cloudbase.net/cli/install | bash`
    - CDN 提供 `/install`（别名）指向 `/install/install.sh`
    - latest 解析：`https://static.cloudbase.net/cli/stable.txt | beta.txt`

    原生 Windows：`irm https://static.cloudbase.net/cli/install.ps1 | iex`
    - CDN 提供 `/install.ps1`（别名）指向 `/install/install.ps1`
    - latest 解析同上

## 安装脚本设计（更新）

- 入口：`curl -fsSL https://static.cloudbase.net/cli/install | bash`
- 变量：支持 `CHANNEL=stable|beta`、`VERSION=<semver|latest>`、可选 `DOWNLOAD_BASE`。
- 关键步骤：
    1. 检测 OS/ARCH（Darwin/Linux；x64/arm64；Windows 仅 WSL 路径）
    2. 解析版本：当 `VERSION=latest` 时，从 `https://static.cloudbase.net/cli/<channel>.txt` 读取版本号
    3. 创建临时目录：`~/.local/share/cloudbase-cli/versions/.tmp-<version>-<ts>`（失败自动清理）
    4. 下载并校验 sha256
    5. 解压（strip-components=1）到临时目录
    6. 原子切换为 `~/.local/share/cloudbase-cli/versions/<version>`（mv）
    7. 为 `cloudbase`/`tcb`/`cloudbase-mcp` 创建或更新符号链接至 `~/.local/bin`
    8. 若 PATH 未包含 `~/.local/bin` 则输出提示
- 兼容：避免 sudo；仅依赖 `bash`/`curl`/`tar`。
- Windows 适配：
    - 分发层面产出 `windows/{x64,arm64}` 包（含 `node.exe` 与相同目录结构）。
    - 安装脚本仅在 WSL 下执行；检测到 Git Bash/MSYS/Cygwin 时提示转到 WSL 并退出。
    - 新增 PowerShell 版安装器与 `.zip`：见“PowerShell 安装器设计”。

## PowerShell 安装器设计（新增）

- 脚本：`install.ps1`（根 CDN：`/install/install.ps1`，别名 `/install.ps1`）
- 主要逻辑：
    1. 解析 `$env:CHANNEL`/`$env:VERSION`/`$env:DOWNLOAD_BASE`（或脚本参数），默认 `stable`/`latest`/`https://static.cloudbase.net/cli`；
    2. OS/ARCH：基于 `Environment.Is64BitOperatingSystem` 与 `PROCESSOR_ARCHITECTURE` 判定 `x64|arm64`；
    3. 路径：`$Root=$env:LOCALAPPDATA\cloudbase-cli`，`$Versions=$Root\versions`，`$Tmp=$Versions\.tmp-<guid>`；
    4. 下载：`Invoke-WebRequest` 到临时文件，读取对应 `.sha256`，校验哈希；
    5. 解压：`Expand-Archive` 到 `$Tmp\cloudbase-cli-<version>`；
    6. 原子切换：若存在 `$Versions\<version>` 则清理；`Move-Item $Tmp\cloudbase-cli-<version> $Versions\<version>`；
    7. 记录当前：写入 `$Root\current.txt` 为 `<version>`；
    8. 生成启动器：`$Root\bin\{cloudbase,tcb,cloudbase-mcp}.cmd`，内容调用 `node.exe` 运行 `cli.js`/`mcp.js`；
    9. PATH 提示：若 `%LOCALAPPDATA%\cloudbase-cli\bin` 未在 PATH，输出添加建议；

10. 清理：删除 `$Tmp`；异常时回滚并输出错误；
11. 可选：执行自更新/回滚命令与卸载脚本支持。

## current 符号链接方案（新增）

- 目的：实现升级/回滚的原子切换与可诊断性，减少反复改动 `~/.local/bin`。
- 目录结构（用户主目录下）：
    - `~/.local/share/cloudbase-cli/versions/<version>/`：每个版本一目录
    - `~/.local/share/cloudbase-cli/current -> versions/<version>`：指向“当前生效版本”的符号链接
    - `~/.local/bin/{cloudbase,tcb,cloudbase-mcp} -> ~/.local/share/cloudbase-cli/current/bin/<name>`
- 安装流程中的切换顺序：
    1. 完成解压到 `versions/<version>`
    2. 原子更新 `current` 指向该版本（`ln -sfn`）
    3. 将 `~/.local/bin` 的 3 个命令统一指向 `current/bin/*`（后续版本切换无需再改动）
- 回滚流程：仅需更新 `current` 指向上一个版本；`~/.local/bin` 无需改动。

## cloudbase-mcp 入口设计（最终）

- 入口：包内 `mcp.js`，来自已发布的 `@cloudbase/cloudbase-mcp` 模块（复制其 `dist/cli.cjs`）。
- 启动：`bin/cloudbase-mcp` 调用 `./node ./mcp.js "$@"`。
- 与主 CLI 解耦：mcp 不参与 webpack bundling，避免 `exports` 限制与打包体积膨胀；与主 CLI 共用同一内置 Node。
- 验证策略：安装阶段仅做静态校验（存在性/可读性），避免运行 `--help` 时进入常驻进程导致阻塞。

## 低码链路处理（Strategy A，最终落地）

- 决策：核心 CLI 与低码解耦；在 bundle 中剔除低码等重型依赖。
- 实施：
    - 打包：使用 IgnorePlugin 剔除 `@cloudbase/lowcode-*`、`vue-loader`、`@vue/compiler-sfc`、`consolidate`、`webpack-dev-server` 等；对原生或可选依赖标记 externals。
    - nodemon 系命令：对 `nodemon` 改为运行时可选 `require`，缺失时给出引导提示（独立发行版不内置）。
    - 运行：低码相关命令可后续按需引导安装。
- 影响：
    - 常规 CLI 能力不受影响；包体显著减小，安装速度与成功率提升。
    - 低码能力需二次安装，避免影响主 CLI 的安装质量与体积。

## 升级与回滚（已实现）

- 命令（新增）：
    - `tcb self-update [--version <v>] [--channel stable|beta] [--download-base <url>]`
    - `tcb rollback`
- 行为说明：
    - self-update：优先调用“当前安装目录中的安装器”`~/.local/share/cloudbase-cli/current/install.sh` 执行更新；若缺失再回退为 `curl -fsSL <DOWNLOAD_BASE>/install | bash`。
    - 参数透传：通过环境变量向安装器传递 `VERSION`、`CHANNEL`、`DOWNLOAD_BASE`，下载并安装目标版本。
    - 原子切换：安装器采用“临时目录解压 + `mv`”与 `current` 符号链接，确保中断可恢复、不破坏已安装版本。
    - 回滚：枚举 `versions/` 子目录，选择上一个版本，更新 `current` 指向该版本并输出结果。
    - 版本保留：后续引入“最多保留 N 个版本（默认≥2）”的清理策略，避免磁盘占用过大。

## 构建与打包流程（新增，更新）

- `build/scripts/fetch-node.sh`：从 `nodejs.org` 下载官方 Node（默认 v22.18.0，可通过 `NODE_VERSION` 覆盖）到 `build/runtime/<os>/<arch>/node`。
- `build/scripts/package.sh`：组装单平台包；若未提供内置 Node，开发模式下回退复制系统 `node`（仅本地调试）。
- `build/scripts/build-all.sh`：
    - 使用 `package.json` 版本号；构建前清理 `out/`；
    - 自动拉取 Node（darwin/linux/windows × x64/arm64），Windows 从 `nodejs.org` 下载 `.zip` 并抽取 `node.exe`；
    - 打包 darwin/linux/windows × x64/arm64；
    - 生成 `out/stable.txt` / `out/beta.txt` 与 `out/install/install.sh`；
    - 收尾执行 `prune-out.sh`，删除 `out/artifacts` 与 `out/unpacked`，并创建 `/install` 别名（指向 `/install/install.sh`）。

## 输出净化（实现）

- 关闭无关警告：在入口对 Node 弃用告警做静默处理。
- 过滤偶发 `[NaN]` 日志：在入口包裹 `console.log`，忽略仅包含单个 `NaN` 的数组打印（源自第三方依赖的边缘输出）。

## 与 npm 全局安装的冲突处理

- 检测：`command -v cloudbase|tcb|cloudbase-mcp` 显示现有路径；若非 `~/.local/bin` 则提示 PATH 优先级调整。
- 策略：不覆盖系统路径与全局可执行；仅在 `~/.local/bin` 建立链接并提示将其置前。
- 提供检测命令提示：`which -a cloudbase`、`echo $PATH` 调整方法。

## 打包策略（webpack 单文件）

- 工具：参考 `CloudBase-AI-ToolKit/mcp/webpack/cli.config.cjs`，产出单 `index.js`。
- 多入口：在 runtime 通过 `process.env.CLI_BIN_NAME` 区分行为，或在 JS 层读取 `process.argv[1]` 判断调用来源。
- Node 运行时：随包包含 `node`（22）；launcher 固定调用 `./node`，避免系统 Node 差异。
- 原生依赖：若发现原生模块（如 sqlite3），按 OS/ARCH 预编译并随包置于 `assets/`，运行时设置 `NODE_OPTIONS=--no-addons` 或 `NODE_PATH`/`LD_LIBRARY_PATH` 定位（仅必要时）。

## 分平台打包评估结论

- 必须分平台打包：内置 Node 需按 OS/ARCH 分发，至少 darwin/linux × x64/arm64（四包）。
- JS bundle 不分平台：当前依赖未见强原生模块，webpack 单文件在各平台通用。
- cloudbase-mcp：与主 CLI 共用 bundle 与内置 Node，随 OS/ARCH 同步分发。
- 建议策略：单 JS bundle + 按 OS/ARCH 发四包。
- 风险提示：如存在可选原生加速（例 `bufferutil`/`utf-8-validate`），建议通过 webpack IgnorePlugin/alias 明确排除，避免触发编译路径。

## 兼容性（更新）

- macOS: darwin x64/arm64（Apple Silicon 原生）
- Linux: glibc x64/arm64（要求 `tar`/`bash` 可用）
- Windows: 推荐使用 WSL。若在 Git Bash/MSYS/Cygwin 环境执行安装脚本，将提示切换到 WSL 并退出。

## 观测（可选，默认关闭）

- 安装器支持 `CLOUDBASE_CLI_REPORT=1` 时，匿名上报：版本、OS/ARCH、结果、耗时；失败错误码。
- 传输：HTTPS，最小字段，无个人数据。

## 安全

- 强制 HTTPS；校验 `sha256`；脚本最小权限；不使用 sudo。
- 升级原子性保障：临时目录 + `mv`，失败自动清理。

## 卸载

- 删除目录：`rm -rf ~/.local/share/cloudbase-cli`。
- 删除链接：`rm -f ~/.local/bin/{cloudbase,tcb,cloudbase-mcp}`。

## 风险与缓解

- 包体过大：控制 ≤ 80MB；按需裁剪依赖；必要时拆分资源到 `assets/` 懒加载。
- PATH 冲突：明确检测与提示脚本；不自动改 PATH 避免破坏用户环境。
- 原生依赖差异：优先纯 JS；确需原生则预编译并在 CI 验证多平台。

## 开放问题（需对齐）

1. 分发域名与是否提供国内镜像域（例如 `download.cloudbase.cn`）。
2. Node 版本锁定为 22 是否合适（或 20 LTS）。
3. 包体上限与保留版本数策略（默认 2 个）。
4. `cloudbase-mcp` 是否需要与主 CLI 解耦为独立包形态（当前为多入口同包）。
