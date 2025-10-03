# 需求文档：CloudBase CLI 安装脚本升级（调研阶段）

## 介绍

为解决通过 npm 全局安装 `@cloudbase/cli` 安装慢、受 Node 版本影响、失败率偏高等问题，参考 Cursor CLI 的“预打包 + curl|bash 一键安装”方式，提供跨平台、高成功率、可原子升级与回滚的安装体验，并同时暴露 `cloudbase`、`tcb`、`cloudbase-mcp` 三个可执行入口。

## 参考背景信息（原始输入摘录）

- 现状：`npm i -g @cloudbase/cli` 容易出现问题
    - 安装速度缓慢、依赖 npm
    - Node 版本可能过低导致失败
- 目标：提升安装成功率与速度
- 参考 Cursor CLI 的安装方式：`curl https://cursor.com/install -fsS | bash`
- 安装脚本示例（来自参考）：

```bash
#!/usr/bin/env bash

# Color definitions
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Fancy header
echo ""
echo -e "${BOLD}Cursor Agent Installer${NC}"
echo ""

# Function to print steps with style
print_step() {
    echo -e "${BLUE}▸${NC} ${1}"
}

# Function to print success
print_success() {
    # Move cursor up one line and clear it
    echo -ne "\033[1A\033[2K"
    echo -e "${GREEN}✓${NC} ${1}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗${NC} ${1}"
}

# Detect OS and Architecture
print_step "Detecting system architecture..."

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     OS="linux";;
    Darwin*)    OS="darwin";;
    *)
        print_error "Unsupported operating system: ${OS}"
        exit 1
        ;;
esac

# Detect Architecture
ARCH="$(uname -m)"
case "${ARCH}" in
    x86_64|amd64)  ARCH="x64";;
    arm64|aarch64) ARCH="arm64";;
    *)
        print_error "Unsupported architecture: ${ARCH}"
        exit 1
        ;;
esac

print_success "Detected ${OS}/${ARCH}"

# Installation steps
print_step "Creating installation directory..."
# Create temporary directory for atomic download inside versions folder
TEMP_EXTRACT_DIR="$HOME/.local/share/cursor-agent/versions/.tmp-2025.08.09-d8191f3-$(date +%s)"
mkdir -p "${TEMP_EXTRACT_DIR}"

print_success "Directory created"


print_step "Downloading Cursor Agent package..."
DOWNLOAD_URL="https://downloads.cursor.com/lab/2025.08.09-d8191f3/${OS}/${ARCH}/agent-cli-package.tar.gz"
echo -e "${DIM}  Download URL: ${DOWNLOAD_URL}${NC}"

# Cleanup function
cleanup() {
    rm -rf "${TEMP_EXTRACT_DIR}"
}
trap cleanup EXIT

# Download with progress bar and better error handling
if curl -fSL --progress-bar "${DOWNLOAD_URL}" \
  | tar --strip-components=1 -xzf - -C "${TEMP_EXTRACT_DIR}"; then
  echo -ne "\033[1A\033[2K"
  echo -ne "\033[1A\033[2K"
  echo -ne "\033[1A\033[2K"
  print_success "Package downloaded and extracted"
else
    print_error "Download failed. Please check your internet connection and try again."
    print_error "If the problem persists, the package might not be available for ${OS}/${ARCH}."
    cleanup
    exit 1
fi

print_step "Finalizing installation..."
# Atomically move from temp to final destination
FINAL_DIR="$HOME/.local/share/cursor-agent/versions/2025.08.09-d8191f3"
rm -rf "${FINAL_DIR}"
if mv "${TEMP_EXTRACT_DIR}" "${FINAL_DIR}"; then
  print_success "Package installed successfully"
else
    print_error "Failed to install package. Please check permissions."
    cleanup
    exit 1
fi


print_step "Creating bin directory..."
mkdir -p ~/.local/bin
print_success "Bin directory ready"


print_step "Creating symlink to cursor-agent executable..."
# Remove any existing symlink or file
rm -f ~/.local/bin/cursor-agent
# Create symlink to the cursor-agent executable
ln -s ~/.local/share/cursor-agent/versions/2025.08.09-d8191f3/cursor-agent ~/.local/bin/cursor-agent
print_success "Symlink created"

# Success message
echo ""
echo -e "${BOLD}${GREEN}✨ Installation Complete! ${NC}"
echo ""
echo ""

# Determine configured shells
CURRENT_SHELL="$(basename $SHELL)"
SHOW_BASH=false
SHOW_ZSH=false
SHOW_FISH=false

case "${CURRENT_SHELL}" in
  bash) SHOW_BASH=true ;;
  zsh) SHOW_ZSH=true ;;
  fish) SHOW_FISH=true ;;
cesac

# Also consider presence of config files as configured
if [ -f "$HOME/.bashrc" ] || [ -f "$HOME/.bash_profile" ]; then SHOW_BASH=true; fi
if [ -f "$HOME/.zshrc" ]; then SHOW_ZSH=true; fi
if [ -f "$HOME/.config/fish/config.fish" ]; then SHOW_FISH=true; fi

# Next steps with style
echo -e "${BOLD}Next Steps${NC}"
echo ""
echo -e "${BOLD}1.${NC} Add ~/.local/bin to your PATH:"

if [ "${SHOW_BASH}" = true ]; then
  echo -e "   ${DIM}For bash:${NC}"
  echo -e "   ${BOLD}${BLUE}echo 'export PATH=\"$HOME/.local/bin:$PATH\"' >> ~/.bashrc${NC}"
  echo -e "   ${BOLD}${BLUE}source ~/.bashrc${NC}"
  echo ""
fi

if [ "${SHOW_ZSH}" = true ]; then
  echo -e "   ${DIM}For zsh:${NC}"
  echo -e "   ${BOLD}${BLUE}echo 'export PATH=\"$HOME/.local/bin:$PATH\"' >> ~/.zshrc${NC}"
  echo -e "   ${BOLD}${BLUE}source ~/.zshrc${NC}"
  echo ""
fi

if [ "${SHOW_FISH}" = true ]; then
  echo -e "   ${DIM}For fish:${NC}"
  echo -e "   ${BOLD}${BLUE}mkdir -p $HOME/.config/fish${NC}"
  echo -e "   ${BOLD}${BLUE}echo 'fish_add_path $HOME/.local/bin' >> $HOME/.config/fish/config.fish${NC}"
  echo -e "   ${BOLD}${BLUE}source $HOME/.config/fish/config.fish${NC}"
  echo ""
fi

# Fallback if no known shells detected/configured
if [ "${SHOW_BASH}" != true ] && [ "${SHOW_ZSH}" != true ] && [ "${SHOW_FISH}" != true ]; then
  echo -e "   ${DIM}Add to PATH manually:${NC}"
  echo -e "   ${BOLD}${BLUE}export PATH=\"$HOME/.local/bin:$PATH\"${NC}"
  echo ""
fi

echo -e "${BOLD}2.${NC} Start using Cursor Agent:"
echo -e "   ${BOLD}cursor-agent${NC}"
echo ""
echo ""
echo -e "${BOLD}${CYAN}Happy coding! 🚀${NC}"
echo "%"
```

- 示例包地址：`https://downloads.cursor.com/lab/2025.08.09-d8191f3/darwin/arm64/agent-cli-package.tar.gz`
- 示例包内容：

```bash
/Users/bookerzhao/Downloads/dist-package
├── build
|  └── node_sqlite3.node
├── cursor-agent
├── index.js
├── node
├── package.json
└── rg

directory: 1 file: 6

ignored
```

- 观察与结论：
    - 包内置 `cursor-agent`、`node`（Node 22）、`index.js` 与必要原生依赖，安装无需系统 Node/npm。
    - 价值：提升安装成功率与速度；bundle 后方便被 VS Code 扩展等调用。

- 方案参考要点（来自原始输入）：
    1. CLI bundle 参考：`https://github.com/TencentCloudBase/CloudBase-AI-ToolKit/blob/main/mcp/webpack/cli.config.cjs`
    2. 内置并暴露多个 bin：`cloudbase`、`tcb`、`cloudbase-mcp`
    3. 与本地 npm 安装命令冲突的处理策略
    4. 升级策略（含自更新/回滚）
    5. 是否需要打包多个 tar 包的评估（按 OS/ARCH 拆分）

## 需求（EARS）

### 1. 一键安装脚本（更新：含原生 Windows）

- 用户故事：作为新用户，我希望通过一条命令完成安装，无需预装 Node 或 npm。
- 验收（EARS）：
    - While 在 macOS/Linux，when 执行 `curl -fsSL https://<domain>/install | bash`，the 安装器 shall 检测 OS/ARCH，创建 `~/.local/share/cloudbase-cli/versions/<version>`，解压包，维护 `current` 链接，创建到 `~/.local/bin` 的 `cloudbase`/`tcb`/`cloudbase-mcp` 符号链接，并输出 PATH 配置指引；无需 sudo。
    - While 在原生 Windows（PowerShell 7+/5.1），when 执行 `irm https://<domain>/install.ps1 | iex`（或下载后执行），the 安装器 shall 检测架构，创建 `%LOCALAPPDATA%\\cloudbase-cli\\versions\\<version>`，解压 `.zip` 包，更新 `current.txt` 指向版本，生成 `%LOCALAPPDATA%\\cloudbase-cli\\bin\\{cloudbase,tcb,cloudbase-mcp}.cmd` 并提示将该 bin 目录加入 PATH。

### 2. 预置运行时（内置 Node）

- 用户故事：我不希望因本地 Node 版本不满足而失败。
- 验收：When 运行任一入口，the 运行时 shall 使用随包分发的 Node（建议 Node 22 LTS），不依赖系统 Node。

### 3. 多入口暴露与行为一致

- 用户故事：我需要继续使用 `cloudbase`、`tcb`，并使用 `cloudbase-mcp`。
- 验收：When 完成安装，the 系统 shall 暴露三命令，均可独立执行 `-v`、`-h`；其中 `cloudbase`/`tcb` 通过 `cli.js` 启动，`cloudbase-mcp` 通过包内 `mcp.js`（复制自 `@cloudbase/cloudbase-mcp/dist/cli.cjs`）启动，行为与 npm 安装一致。

### 4. 包分发与结构（更新：含 Windows .zip 与安装器）

- 用户故事：作为发布者，我需要稳定分发与清晰目录，支持 CDN。
- 验收：When 发布 `<version>`，the 服务端 shall 提供 `{darwin,linux}/{x64,arm64}` 的 `.tar.gz{,.sha256}` 与 `{windows}/{x64,arm64}` 的 `.zip{,.sha256}`；包内含 `node`（或 `node.exe`）、`bin/*`、`cli.js`、`mcp.js`、`manifest.json`；线上采用版本化目录：
    - `/<version>/{darwin,linux}/{x64,arm64}/cloudbase-cli-<version>.tar.gz{,.sha256}`
    - `/<version>/windows/{x64,arm64}/cloudbase-cli-<version>.zip{,.sha256}`
    - 根目录提供 `install/install.sh`（别名 `/install`）与 `install/install.ps1`（别名 `/install.ps1`）、`stable.txt`、`beta.txt`。

### 5. 自更新与回滚（原子）

- 用户故事：我希望一键升级且可回滚。
- 验收：When 执行 `cloudbase self-update` 或重跑安装脚本，the 安装器 shall 下载至临时目录并原子切换 `versions/<version>` 与符号链接；至少保留 1 个上版本用于 `--rollback`；失败不影响当前可用版本。

### 6. 与 npm 全局安装冲突处理

- 用户故事：历史用户可能已通过 npm 安装，避免冲突。
- 验收：When 检测到 PATH 中存在同名命令，the 安装器 shall 提示 PATH 优先级调整与检测命令；默认不覆盖，仅创建 `~/.local/bin` 链接并提示置前。

### 7. 性能目标与网络备选

- 用户故事：在一般网络环境也能快速安装。
- 验收：While 中国大陆网络，when 下载同版本包，the P99 安装耗时 ≤ 20s（100Mbps，包体≤80MB）

### 8. 安全与完整性

- 用户故事：我需要确认下载可信。
- 验收：When 执行安装，the 安装器 shall 强制 HTTPS、校验 `sha256`（或 `minisign`/COS 签名）；脚本最小权限、无 sudo；提供卸载指令（删除 `~/.local/share/cloudbase-cli` 与链接）。

### 9. 兼容性与范围（更新：含原生 Windows）

- 用户故事：我在常见桌面/服务器上可用。
- 验收：the 首版 shall 支持 macOS（darwin x64/arm64）与 Linux（glibc x64/arm64）；原生 Windows（x64/arm64）通过 PowerShell 安装器与 `.zip` 产物完成安装；若在 Git Bash/MSYS/Cygwin 下执行 `install.sh`，安装器 shall 直接提示改用 WSL 或使用 PowerShell 安装器。

### 11. Windows 原生安装器（新增）

- 用户故事：在不使用 WSL 的情况下，我希望用 PowerShell 一键安装/升级/回滚。
- 验收（EARS）：
    - When 执行 `irm https://<domain>/install.ps1 | iex`，the 安装器 shall：
        1. 解析 `CHANNEL`/`VERSION`/`DOWNLOAD_BASE`；
        2. 下载并校验 `.zip` 与 `.sha256`；
        3. 解压到 `%LOCALAPPDATA%\\cloudbase-cli\\versions\\<version>`（使用临时目录 + 原子移动）；
        4. 写入/更新 `%LOCALAPPDATA%\\cloudbase-cli\\current.txt`；
        5. 生成或更新 `%LOCALAPPDATA%\\cloudbase-cli\\bin\\{cloudbase,tcb,cloudbase-mcp}.cmd`；
        6. 输出 PATH 提示与卸载说明。

## CDN 上传清单与缓存策略（更新）

- 上传清单：
    - `/<version>/{darwin,linux,windows}/{x64,arm64}/cloudbase-cli-<version>.tar.gz{,.sha256}`
    - `/install/install.sh` 与别名 `/install`
    - `/stable.txt`、`/beta.txt`
- 忽略：
    - `/artifacts/**`、`/unpacked/**`（仅本地/CI 使用）
    - 本地构建完成后通过清理脚本仅保留版本化目录与安装脚本（prune）
- 缓存策略建议：
    - 版本化包与 `.sha256`：长缓存（immutable）
    - 安装脚本 `/install`：中等缓存，可刷新
    - `stable.txt`/`beta.txt`：短缓存（5~15 分钟）

### 10. 观测与可运维

- 用户故事：发布者需要感知安装质量。
- 验收：When 安装完成或失败，the 安装器 shall 在用户允许前提下匿名上报版本、OS/ARCH、结果与耗时（默认关闭，明示开启）。

## 非目标

- 不在首版自动修改 PATH（仅提示）。
- 不强制移除/覆盖 npm 全局安装。

## 约束与依赖

- 分发域名与 CDN（建议 COS+CDN，国内外双域与回源）。
- Node 运行时版本：建议 Node 22 LTS；若含原生依赖需按 OS/ARCH 预编译。
- Bundle 方案：参考 CloudBase-AI-ToolKit `mcp/webpack/cli.config.cjs`；选择 `webpack` 单文件，以稳定优先；必要时随包内置额外二进制。

## 开放问题（待确认）

1. 分发域名与镜像策略（是否提供国内镜像域）。
2. 运行时版本（Node 20 vs 22）与许可证合规说明。
3. 包体上限与更新频率；是否拆分 runtime 层与 app 层以减少增量。
4. `cloudbase-mcp` 的暴露方式：多入口单包 vs 独立启动脚本。
5. 自更新渠道：稳定/beta 双通道与命令设计（如 `--channel beta`）。
