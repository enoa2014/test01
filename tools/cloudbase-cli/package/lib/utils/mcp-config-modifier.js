'use strict'
var __createBinding =
    (this && this.__createBinding) ||
    (Object.create
        ? function (o, m, k, k2) {
              if (k2 === undefined) k2 = k
              var desc = Object.getOwnPropertyDescriptor(m, k)
              if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
                  desc = {
                      enumerable: true,
                      get: function () {
                          return m[k]
                      }
                  }
              }
              Object.defineProperty(o, k2, desc)
          }
        : function (o, m, k, k2) {
              if (k2 === undefined) k2 = k
              o[k2] = m[k]
          })
var __setModuleDefault =
    (this && this.__setModuleDefault) ||
    (Object.create
        ? function (o, v) {
              Object.defineProperty(o, 'default', { enumerable: true, value: v })
          }
        : function (o, v) {
              o['default'] = v
          })
var __importStar =
    (this && this.__importStar) ||
    function (mod) {
        if (mod && mod.__esModule) return mod
        var result = {}
        if (mod != null)
            for (var k in mod)
                if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k))
                    __createBinding(result, mod, k)
        __setModuleDefault(result, mod)
        return result
    }
var __awaiter =
    (this && this.__awaiter) ||
    function (thisArg, _arguments, P, generator) {
        function adopt(value) {
            return value instanceof P
                ? value
                : new P(function (resolve) {
                      resolve(value)
                  })
        }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) {
                try {
                    step(generator.next(value))
                } catch (e) {
                    reject(e)
                }
            }
            function rejected(value) {
                try {
                    step(generator['throw'](value))
                } catch (e) {
                    reject(e)
                }
            }
            function step(result) {
                result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected)
            }
            step((generator = generator.apply(thisArg, _arguments || [])).next())
        })
    }
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, '__esModule', { value: true })
exports.MCPConfigModifier = void 0
const fs_extra_1 = __importDefault(require('fs-extra'))
const path_1 = __importDefault(require('path'))
const IDE_FILE_MAPPINGS = {
    cursor: [
        { path: '.cursor/rules/cloudbase-rules.mdc' },
        { path: '.cursor/mcp.json', isMcpConfig: true }
    ],
    windsurf: [{ path: '.windsurf/rules/cloudbase-rules.md' }],
    codebuddy: [{ path: '.rules/cloudbase-rules.md' }],
    'claude-code': [{ path: 'CLAUDE.md' }, { path: '.mcp.json', isMcpConfig: true }],
    cline: [{ path: '.clinerules/cloudbase-rules.mdc' }],
    'gemini-cli': [
        { path: '.gemini/GEMINI.md' },
        { path: '.gemini/settings.json', isMcpConfig: true }
    ],
    opencode: [{ path: '.opencode.json', isMcpConfig: true }],
    'qwen-code': [{ path: '.qwen/QWEN.md' }, { path: '.qwen/settings.json', isMcpConfig: true }],
    'baidu-comate': [
        { path: '.comate/rules/cloudbase-rules.mdr' },
        { path: '.comate/rules/cloudbaase-rules.mdr' },
        { path: '.comate/mcp.json', isMcpConfig: true }
    ],
    'openai-codex-cli': [{ path: '.codex/config.toml', isMcpConfig: true }, { path: 'AGENTS.md' }],
    'augment-code': [{ path: '.augment-guidelines' }],
    'github-copilot': [{ path: '.github/copilot-instructions.md' }],
    roocode: [
        { path: '.roo/rules/cloudbaase-rules.md' },
        { path: '.roo/mcp.json', isMcpConfig: true }
    ],
    'tongyi-lingma': [{ path: '.lingma/rules/cloudbaase-rules.md' }],
    trae: [{ path: '.trae/rules/cloudbase-rules.md' }],
    vscode: [{ path: '.vscode/mcp.json', isMcpConfig: true }, { path: '.vscode/settings.json' }],
    aider: [{ path: 'mcp.json', isMcpConfig: true }]
}
function inferConfigFormat(filePath) {
    return filePath.toLowerCase().endsWith('.toml') ? 'toml' : 'json'
}
class MCPConfigModifier {
    modifyMCPConfigs(extractDir, log) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                log.info('🔧 正在修改 MCP 配置文件...')
                for (const [ide, files] of Object.entries(IDE_FILE_MAPPINGS)) {
                    for (const descriptor of files) {
                        if (!descriptor.isMcpConfig) continue
                        const filePath = path_1.default.join(extractDir, descriptor.path)
                        log.debug(`检查文件: ${filePath}`)
                        if (yield fs_extra_1.default.pathExists(filePath)) {
                            log.debug(`找到 MCP 配置文件: ${filePath}`)
                            const format = inferConfigFormat(descriptor.path)
                            if (format === 'json') {
                                yield this.modifyMCPJsonFile(filePath, log)
                            } else if (format === 'toml') {
                                yield this.modifyMCPTomlFile(filePath, log)
                            }
                        } else {
                            log.debug(`文件不存在: ${filePath}`)
                        }
                    }
                }
                log.info('✅ MCP 配置文件修改完成')
            } catch (error) {
                log.warn(`⚠️  MCP 配置文件修改失败: ${error.message}`)
            }
        })
    }
    modifyMCPJsonFile(filePath, log) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const content = yield fs_extra_1.default.readFile(filePath, 'utf-8')
                const config = JSON.parse(content)
                log.debug(`读取配置文件 ${filePath}: ${JSON.stringify(config)}`)
                let modified = false
                const modifyCommands = (obj) => {
                    if (typeof obj !== 'object' || obj === null) {
                        return obj
                    }
                    if (Array.isArray(obj)) {
                        return obj.map((item) => modifyCommands(item))
                    }
                    const result = Object.assign({}, obj)
                    if (result.command === 'npx' && Array.isArray(result.args)) {
                        const argsStr = result.args.join(' ')
                        log.debug(
                            `检查命令: command=${result.command}, args=${JSON.stringify(result.args)}`
                        )
                        if (
                            argsStr.includes('npm-global-exec@latest') &&
                            argsStr.includes('@cloudbase/cloudbase-mcp@latest')
                        ) {
                            log.debug(`匹配到需要修改的命令: ${argsStr}`)
                            result.command = 'cloudbase-mcp'
                            result.args = []
                            result.env = {
                                INTEGRATION_IDE: process.env.INTEGRATION_IDE || 'CloudBaseCLI'
                            }
                            modified = true
                            log.debug(`修改配置文件 ${filePath}: npx -> cloudbase-mcp`)
                        } else {
                            log.debug(`命令不匹配修改条件: ${argsStr}`)
                        }
                    }
                    for (const [key, value] of Object.entries(result)) {
                        result[key] = modifyCommands(value)
                    }
                    return result
                }
                const modifiedConfig = modifyCommands(config)
                if (modified) {
                    yield fs_extra_1.default.writeJson(filePath, modifiedConfig, { spaces: 2 })
                    log.debug(`✅ 已修改 ${filePath}`)
                } else {
                    log.debug(`⚠️  配置文件 ${filePath} 未发生修改`)
                }
            } catch (error) {
                log.warn(`⚠️  修改配置文件 ${filePath} 失败: ${error.message}`)
            }
        })
    }
    modifyMCPTomlFile(filePath, log) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const content = yield fs_extra_1.default.readFile(filePath, 'utf-8')
                const toml = yield Promise.resolve().then(() => __importStar(require('toml')))
                const config = toml.parse(content)
                let modified = false
                const modifyCommands = (obj) => {
                    if (typeof obj !== 'object' || obj === null) {
                        return obj
                    }
                    if (Array.isArray(obj)) {
                        return obj.map((item) => modifyCommands(item))
                    }
                    const result = Object.assign({}, obj)
                    if (result.command === 'npx' && Array.isArray(result.args)) {
                        const argsStr = result.args.join(' ')
                        if (argsStr.includes('@cloudbase/cloudbase-mcp@latest')) {
                            result.command = 'cloudbase-mcp'
                            result.args = []
                            result.env = {
                                INTEGRATION_IDE: process.env.INTEGRATION_IDE || 'CloudBaseCLI'
                            }
                            modified = true
                            log.debug(`修改配置文件 ${filePath}: npx -> cloudbase-mcp`)
                        }
                    }
                    for (const [key, value] of Object.entries(result)) {
                        result[key] = modifyCommands(value)
                    }
                    return result
                }
                const modifiedConfig = modifyCommands(config)
                if (modified) {
                    const tomlString = this.objectToToml(modifiedConfig)
                    yield fs_extra_1.default.writeFile(filePath, tomlString, 'utf-8')
                    log.debug(`✅ 已修改 ${filePath}`)
                }
            } catch (error) {
                log.warn(`⚠️  修改配置文件 ${filePath} 失败: ${error.message}`)
            }
        })
    }
    objectToToml(obj, prefix = '') {
        const lines = []
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                lines.push(`[${fullKey}]`)
                lines.push(this.objectToToml(value, fullKey))
            } else if (Array.isArray(value)) {
                const arrayStr = value
                    .map((item) => {
                        if (typeof item === 'string') {
                            return `"${item}"`
                        }
                        return item
                    })
                    .join(', ')
                lines.push(`${key} = [${arrayStr}]`)
            } else if (typeof value === 'string') {
                lines.push(`${key} = "${value}"`)
            } else {
                lines.push(`${key} = ${value}`)
            }
        }
        return lines.join('\n')
    }
}
exports.MCPConfigModifier = MCPConfigModifier
