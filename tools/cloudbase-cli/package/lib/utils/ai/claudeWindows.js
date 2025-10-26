'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.claudeWindowsCheck = void 0
const child_process_1 = require('child_process')
const path_1 = require('path')
const output_1 = require('../output')
function claudeWindowsCheck(log) {
    const claudeWindowsCheck = checkWindowsClaudeOk()
    if ('error' in claudeWindowsCheck) {
        log.error(claudeWindowsCheck.error)
        process.exit(1)
    }
}
exports.claudeWindowsCheck = claudeWindowsCheck
function checkWindowsClaudeOk() {
    if (process.platform !== 'win32') return { success: true }
    if (process.env.CLAUDE_CODE_GIT_BASH_PATH) {
        if (pathExistsOnWindows(process.env.CLAUDE_CODE_GIT_BASH_PATH)) return { success: true }
        return {
            error: `环境变量 CLAUDE_CODE_GIT_BASH_PATH 指定的路径 "${process.env.CLAUDE_CODE_GIT_BASH_PATH}" 不存在，请检查`
        }
    }
    let gitExecutablePath = resolveWindowsExecutablePath('git')
    if (gitExecutablePath) {
        let bashExeCandidate = path_1.win32.join(gitExecutablePath, '..', '..', 'bin', 'bash.exe')
        if (pathExistsOnWindows(bashExeCandidate)) return { success: true }
    }
    return {
        error: `Claude Code 在 Windows 上需要 git-bash (https://git-scm.com/downloads/win)。如果已安装但不在 PATH 中，请设置环境变量 CLAUDE_CODE_GIT_BASH_PATH 指向你的 bash.exe，类似：CLAUDE_CODE_GIT_BASH_PATH=C:\\Program Files\\Git\\bin\\bash.exe
或者使用 WSL 运行。详情可阅读官方文档 ${(0, output_1.genClickableLink)('https://docs.anthropic.com/zh-CN/docs/claude-code/setup#windows-%E8%AE%BE%E7%BD%AE')}`
    }
}
function pathExistsOnWindows(targetPath) {
    try {
        return (0, child_process_1.execSync)(`dir "${targetPath}"`, { stdio: 'pipe' })
    } catch (_a) {
        return !1
    }
}
function resolveWindowsExecutablePath(executableName) {
    if (executableName === 'git') {
        let candidatePaths = [
            'C:\\Program Files\\Git\\cmd\\git.exe',
            'C:\\Program Files (x86)\\Git\\cmd\\git.exe'
        ]
        for (let candidatePath of candidatePaths)
            if (pathExistsOnWindows(candidatePath)) return candidatePath
    }
    try {
        return (
            (0, child_process_1.execSync)(`where.exe ${executableName}`, {
                stdio: 'pipe',
                encoding: 'utf8'
            }).trim().split(`\r
`)[0] || null
        )
    } catch (_a) {
        return null
    }
}
