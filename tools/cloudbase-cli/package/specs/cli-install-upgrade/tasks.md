# 实施计划（仅规划，不实施）

- [ ] 0. 基线与对齐
  - 对齐分发域名与镜像策略（国内/海外域）
  - 锁定 Node 运行时版本（建议 22）与许可证合规
  - 版本与通道策略（stable/beta），版本保留数（默认 2）
  - _需求: 约束/开放问题

- [x] 1. Bundle 架构落地（webpack 单文件）
  - 建立 webpack 配置并产出 `dist/standalone/cli.js`
  - 主 CLI 入口为 `cli.js`；`cloudbase-mcp` 通过复制 `@cloudbase/cloudbase-mcp/dist/cli.cjs` 为 `mcp.js`
  - Ignore 可选/重型依赖（低码链路、dev server 等）；externals 标记原生/可选模块
  - _需求: 2,3

- [x] 2. 启动脚本与多入口
  - 包内 `bin/cloudbase`、`bin/tcb`：`./node ./cli.js "$@"`；`bin/cloudbase-mcp`：`./node ./mcp.js "$@"`
  - 启动器增强：支持从符号链接调用时解析真实路径
  - _需求: 1,3

- [x] 3. 安装脚本（curl|bash）
  - OS/ARCH 探测、目录与临时目录创建、下载、sha256 校验
  - 解压（strip-components=1）、原子 `mv` 切换版本目录
  - 维护 `current` 链接；`~/.local/bin/*` 指向 `current/bin/*`
  - 创建 `~/.local/bin` 符号链接与 PATH 提示（不自动改）
  - Windows 适配：Git Bash/MSYS/Cygwin 下提示改用 WSL 并退出；WSL 下按 Linux 流程
  - _需求: 1,8,9

- [x] 4. 自更新与回滚
  - `cloudbase self-update [--channel beta]`、`--rollback`
  - manifest 查询、下载校验、原子切换、版本保留与清理
  - _需求: 5

- [ ] 5. 与 npm 全局安装冲突处理
  - 安装脚本：检测 `command -v`，提示 PATH 优先级与排查命令
  - 运行时：`cloudbase doctor path`（可选）输出排查建议
  - _需求: 6

- [x] 6. 分发与清单
  - 目录规范：`/<version>/{darwin|linux}/{x64|arm64}/cloudbase-cli-<version>.tar.gz{,.sha256}`
  - 生成 `manifest.json`（包内）与 `.sha256`；根目录提供 `install/install.sh`、`stable.txt`、`beta.txt`
  - _需求: 4

- [x] 7. CI/CD 构建矩阵（本地脚本）
  - 构建矩阵：darwin/linux/windows × x64/arm64（共六包）
  - `build/scripts/fetch-node.sh` 拉取官方 Node（含 windows `.zip` 提取 `node.exe`）；`build/scripts/build-all.sh` 一键清理+构建+打包+收尾清理
  - 收尾清理：执行 `build/scripts/prune-out.sh`，仅保留 `out/<version>/**`、`out/install/install.sh`（及别名 `/install`）、`stable.txt`、`beta.txt`
  - 产物上传 COS + CDN 刷新（CI 待接入）
  - 冒烟脚本：安装 -> 运行 `cloudbase -v` / 静态校验 `cloudbase-mcp` 文件
  - _需求: 4,7,10

- [ ] 8. 观测（可选，默认关闭）
  - 安装脚本：尊重 `CLOUDBASE_CLI_REPORT=1` 开关，上报匿名指标
  - 域名与接口对齐，文档披露与退出机制
  - _需求: 10

- [ ] 9. 安全与合规
  - 强制 HTTPS、sha256 校验、最小权限、不使用 sudo
  - 第三方依赖许可证检查与 NOTICE
  - _需求: 8

- [ ] 10. 卸载与文档
  - 卸载脚本/指令：清理版本目录与符号链接
  - 文档：README 安装/升级/回滚/卸载、WSL 提示（Git Bash 指向 WSL）
  - _需求: 1,5,9

- [ ] 11. 测试计划
  - 平台验证：macOS x64/arm64，Linux x64/arm64，WSL/Git Bash
  - 网络与镜像：国内/海外、断网/重试、校验失败回滚
  - 冲突与 PATH：同时存在 npm 全局安装的场景
  - _需求: 1,6,7

- [ ] 12. 里程碑与发布
  - 内测版本：beta 渠道与灰度用户
  - 正式发布：稳定域名 + 文档更新 + 退场策略（npm 安装仍保留）
  - _需求: 全局

## 附录：CDN 上传清单与缓存策略（新增）
- 上传清单：
  - `/<version>/{darwin,linux}/{x64,arm64}/cloudbase-cli-<version>.tar.gz{,.sha256}`
  - `/install/install.sh`
  - `/stable.txt`、`/beta.txt`
- 忽略：
  - `/artifacts/**`、`/unpacked/**`
- 缓存建议：
  - 版本化包与 `.sha256`：长缓存（immutable）
  - `/install`：中等缓存；可设置别名至 `/install/install.sh`
  - `stable.txt`/`beta.txt`：短缓存（5~15 分钟）

## 新增：Windows 原生支持实施项

- [ ] W1. Windows `.zip` 产物
  - 更新打包脚本，生成 `/<version>/windows/{x64,arm64}/cloudbase-cli-<version>.zip{,.sha256}`
  - zip 内包含 `node.exe`、`cli.js`、`mcp.js`、`manifest.json`、`install.ps1`
  - _需求: 4, 9, 11

- [ ] W2. CDN 清单与 prune 更新
  - `prune-out.sh` 保留 Windows `.zip` 与 `.sha256`，并生成 `/install.ps1` 别名
  - 文档与清单同步
  - _需求: 4

- [ ] W3. `.cmd` 启动器
  - 生成 `%LOCALAPPDATA%\\cloudbase-cli\\bin\\{cloudbase,tcb,cloudbase-mcp}.cmd`
  - 内容：定位安装根目录，调用 `node.exe` 执行相应 `cli.js`/`mcp.js`，参数透传
  - _需求: 3, 11

- [ ] W4. PowerShell 安装器 `install.ps1`
  - 下载/校验 `.zip`，`Expand-Archive` 解压，原子切换到 `versions/<version>`
  - 写入 `current.txt`，生成 `.cmd` 启动器，PATH 提示
  - 支持 `CHANNEL`/`VERSION`/`DOWNLOAD_BASE` 参数
  - _需求: 1, 5, 11

- [ ] W5. 自更新与回滚（Windows）
  - `tcb self-update` 在 Windows 上可调用在线 `install.ps1`（或本地 `current/install.ps1`）
  - `tcb rollback` 读取 `current.txt` 与 `versions` 列表回退
  - _需求: 5, 11

- [ ] W6. 测试与验证
  - PowerShell 5.1 / 7+、Windows 10/11、Server 2019/2022
  - 签名与执行策略（`Set-ExecutionPolicy Bypass -Scope Process`）文档提示
  - _需求: 10, 11
