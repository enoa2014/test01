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
var __asyncValues =
    (this && this.__asyncValues) ||
    function (o) {
        if (!Symbol.asyncIterator) throw new TypeError('Symbol.asyncIterator is not defined.')
        var m = o[Symbol.asyncIterator],
            i
        return m
            ? m.call(o)
            : ((o = typeof __values === 'function' ? __values(o) : o[Symbol.iterator]()),
              (i = {}),
              verb('next'),
              verb('throw'),
              verb('return'),
              (i[Symbol.asyncIterator] = function () {
                  return this
              }),
              i)
        function verb(n) {
            i[n] =
                o[n] &&
                function (v) {
                    return new Promise(function (resolve, reject) {
                        ;((v = o[n](v)), settle(resolve, reject, v.done, v.value))
                    })
                }
        }
        function settle(resolve, reject, d, v) {
            Promise.resolve(v).then(function (v) {
                resolve({ value: v, done: d })
            }, reject)
        }
    }
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, '__esModule', { value: true })
exports.AICommandRouter = void 0
const child_process_1 = require('child_process')
const config_1 = require('./config')
const error_1 = require('../../error')
const inquirer_1 = __importDefault(require('inquirer'))
const chalk_1 = __importDefault(require('chalk'))
const output_1 = require('../output')
const const_1 = require('./const')
const utils_1 = require('../../commands/utils')
const auth_1 = require('../../auth')
const nodeVersion_1 = require('./nodeVersion')
const claudeWindows_1 = require('./claudeWindows')
const env_1 = require('./env')
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
const MCP_CONFIG_SET = new Set(
    Object.values(IDE_FILE_MAPPINGS).reduce((acc, descriptors) => {
        for (const d of descriptors) {
            if (d.isMcpConfig) acc.push(d.path)
        }
        return acc
    }, [])
)
function inferConfigFormat(filePath) {
    return filePath.toLowerCase().endsWith('.toml') ? 'toml' : 'json'
}
class AICommandRouter {
    constructor() {
        this.configManager = new config_1.AIConfigManager()
    }
    execute({ agent, addtionalArgs, log, template }) {
        var _a
        return __awaiter(this, void 0, void 0, function* () {
            if ((0, config_1.isValidAgent)(agent) !== true) {
                log.error(`❌ 无效的 agent: ${agent}`)
                return
            }
            const config = yield this.configManager.loadConfig()
            if (!config) {
                log.warn("⚠️  未检测到 AI ToolKit CLI 配置，请运行 'tcb ai --setup' 进行配置")
                return
            }
            const agentUpperCased = agent.toUpperCase()
            const agentConfig = (_a = config.agents) === null || _a === void 0 ? void 0 : _a[agent]
            if (!agentConfig) {
                log.warn(`⚠️  未找到 ${agentUpperCased} 配置，请运行 tcb ai --setup 进行配置`)
                return
            }
            log.info(`🚀 启动 ${chalk_1.default.bold(agentUpperCased)} AI CLI 工具`)
            try {
                yield this.checkToolkitConfig(agent, log, template)
            } catch (e) {
                log.warn('⚠️  云开发功能检查失败，但 AI 工具仍可正常使用')
            }
            const isValid = yield this.validateAgentConfig(agent, agentConfig, log)
            if (!isValid) {
                log.warn(`⚠️  ${agent.toUpperCase()} 配置无效，请重新配置`)
                return
            }
            this.executeAgentWithConfig(agent, agentConfig, this.parseArgs(addtionalArgs), log)
        })
    }
    checkToolkitConfig(agent, log, template) {
        return __awaiter(this, void 0, void 0, function* () {
            const { missingFiles } = yield this.configManager.checkToolkitConfig(agent)
            if (missingFiles.length > 0) {
                const skipTemplate = yield this.checkSkipTemplateConfig()
                if (skipTemplate) {
                    log.info(
                        '🚫 已跳过模板下载，无法使用云开发 MCP 及 AI 规则。如需使用，请参考 tcb pull --help'
                    )
                    return
                }
                log.log('')
                yield this.downloadTemplate(log, template)
                log.log('')
            }
        })
    }
    checkSkipTemplateConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fs = yield Promise.resolve().then(() => __importStar(require('fs-extra')))
                const path = yield Promise.resolve().then(() => __importStar(require('path')))
                const skipFile = path.join(process.cwd(), '.skip-template')
                return yield fs.pathExists(skipFile)
            } catch (_a) {
                return false
            }
        })
    }
    saveSkipTemplateConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fs = yield Promise.resolve().then(() => __importStar(require('fs-extra')))
                const path = yield Promise.resolve().then(() => __importStar(require('path')))
                const skipFile = path.join(process.cwd(), '.skip-template')
                yield fs.writeFile(skipFile, new Date().toISOString())
            } catch (error) {}
        })
    }
    downloadTemplate(log, template) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let templateType
                if (template) {
                    templateType = template
                } else {
                    const { templateType: selectedType } = yield inquirer_1.default.prompt([
                        {
                            type: 'list',
                            name: 'templateType',
                            message: `下载模板以获取完整的开发体验: ${const_1.LIST_HINT}`,
                            choices: [
                                { name: '🟦 微信小程序 + CloudBase', value: 'miniprogram' },
                                { name: '🚀 Web 应用 - React + CloudBase', value: 'react' },
                                { name: '🟢 Web 应用 - Vue + CloudBase', value: 'vue' },
                                { name: '🌈 跨端应用 - UniApp + CloudBase', value: 'uniapp' },
                                { name: '🧩 只下载 AI 规则和配置', value: 'rules' },
                                { name: '🚫 不下载模板', value: 'none' }
                            ],
                            default: 'miniprogram'
                        }
                    ])
                    templateType = selectedType
                }
                if (templateType === 'none') {
                    log.info('🚫 跳过模板下载')
                    yield this.saveSkipTemplateConfig()
                    return
                }
                log.info(`📦 正在下载并解压 ${templateType} 模板...`)
                yield this.downloadAndExtractTemplate(templateType, log)
                log.info(`✅ ${templateType} 模板配置完成`)
            } catch (error) {
                log.error(`❌ 配置失败: ${error.message}`)
                throw new error_1.CloudBaseError('模板下载失败', { original: error })
            }
        })
    }
    downloadAndExtractTemplate(templateType, log) {
        var _a, e_1, _b, _c
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield Promise.resolve().then(() => __importStar(require('fs-extra')))
            const path = yield Promise.resolve().then(() => __importStar(require('path')))
            const os = yield Promise.resolve().then(() => __importStar(require('os')))
            const unzipper = yield Promise.resolve().then(() => __importStar(require('unzipper')))
            const https = yield Promise.resolve().then(() => __importStar(require('https')))
            let ConfigParser
            try {
                ConfigParser = (yield Promise.resolve().then(() =>
                    __importStar(require('@cloudbase/toolbox'))
                )).ConfigParser
            } catch (_d) {
                ConfigParser = undefined
            }
            const templateMap = {
                rules: {
                    url: 'https://static.cloudbase.net/cloudbase-examples/web-cloudbase-project.zip'
                },
                react: {
                    url: 'https://static.cloudbase.net/cloudbase-examples/web-cloudbase-react-template.zip'
                },
                vue: {
                    url: 'https://static.cloudbase.net/cloudbase-examples/web-cloudbase-vue-template.zip'
                },
                miniprogram: {
                    url: 'https://static.cloudbase.net/cloudbase-examples/miniprogram-cloudbase-miniprogram-template.zip'
                },
                uniapp: {
                    url: 'https://static.cloudbase.net/cloudbase-examples/universal-cloudbase-uniapp-template.zip'
                }
            }
            const template = templateMap[templateType]
            if (!template) throw new error_1.CloudBaseError('未知模板类型')
            const tmpDir = os.tmpdir()
            const zipPath = path.join(
                tmpDir,
                `cloudbase-template-${templateType}-${Date.now()}.zip`
            )
            yield new Promise((resolve, reject) => {
                const file = fs.createWriteStream(zipPath)
                https
                    .get(template.url, (response) => {
                        if (response.statusCode !== 200) {
                            reject(new Error(`下载失败: ${response.statusCode}`))
                            return
                        }
                        response.pipe(file)
                        file.on('finish', () => {
                            file.close()
                            resolve()
                        })
                    })
                    .on('error', (err) => {
                        fs.unlink(zipPath)
                        reject(err)
                    })
            })
            const extractDir = process.cwd()
            const zipStream = fs
                .createReadStream(zipPath)
                .pipe(unzipper.Parse({ forceStream: true }))
            try {
                for (
                    var _e = true, _f = __asyncValues(zipStream), _g;
                    (_g = yield _f.next()), (_a = _g.done), !_a;

                ) {
                    _c = _g.value
                    _e = false
                    try {
                        const entry = _c
                        const entryPath = entry.path
                        const destPath = path.join(extractDir, entryPath)
                        if (entry.type === 'Directory') {
                            yield fs.ensureDir(destPath)
                            entry.autodrain()
                            continue
                        }
                        if (MCP_CONFIG_SET.has(entryPath)) {
                            try {
                                yield this.mergeMcpConfig(
                                    entry,
                                    destPath,
                                    inferConfigFormat(entryPath),
                                    log
                                )
                            } catch (e) {
                                log.warn(`MCP 配置合并失败 ${entryPath}：${e.message}，已跳过`)
                            }
                            continue
                        }
                        if (entryPath === 'cloudbaserc.json' && (yield fs.pathExists(destPath))) {
                            try {
                                const templateContent = yield entry.buffer()
                                const templateJson = JSON.parse(templateContent.toString('utf8'))
                                const localJson = yield fs.readJson(destPath)
                                const deepMerge = (target, source) => {
                                    if (
                                        typeof target !== 'object' ||
                                        typeof source !== 'object' ||
                                        !target ||
                                        !source
                                    )
                                        return target
                                    const result = Object.assign(Object.assign({}, source), target)
                                    for (const key of Object.keys(source)) {
                                        if (
                                            key in target &&
                                            typeof target[key] === 'object' &&
                                            typeof source[key] === 'object'
                                        ) {
                                            result[key] = deepMerge(target[key], source[key])
                                        }
                                    }
                                    return result
                                }
                                let merged = deepMerge(localJson, templateJson)
                                yield fs.writeJson(destPath, merged, { spaces: 2 })
                            } catch (e) {
                                log.warn('cloudbaserc.json 合并失败，已跳过: ' + e.message)
                            }
                            continue
                        }
                        if (yield fs.pathExists(destPath)) {
                            const { confirmOverwriteFile } = yield inquirer_1.default.prompt([
                                {
                                    type: 'confirm',
                                    name: 'confirmOverwriteFile',
                                    message: `检测到已存在文件 ${entryPath}，是否覆盖？ ${(0, const_1.getBooleanHint)(false)}`,
                                    default: false
                                }
                            ])
                            if (!confirmOverwriteFile) {
                                entry.autodrain()
                                continue
                            }
                        }
                        yield fs.ensureDir(path.dirname(destPath))
                        yield new Promise((res, rej) => {
                            entry
                                .pipe(fs.createWriteStream(destPath))
                                .on('finish', res)
                                .on('error', rej)
                        })
                    } finally {
                        _e = true
                    }
                }
            } catch (e_1_1) {
                e_1 = { error: e_1_1 }
            } finally {
                try {
                    if (!_e && !_a && (_b = _f.return)) yield _b.call(_f)
                } finally {
                    if (e_1) throw e_1.error
                }
            }
            yield fs.unlink(zipPath)
            yield this.modifyMCPConfigs(extractDir, log)
        })
    }
    getInstallCommand(agent) {
        switch (agent) {
            case 'claude':
                return {
                    success: true,
                    command: 'npm',
                    args: ['install', '-g', '@anthropic-ai/claude-code'],
                    message:
                        'macOS/Linux/WSL: curl -fsSL claude.ai/install.sh | bash\nWindows PowerShell: irm https://claude.ai/install.ps1 | iex'
                }
            case 'qwen':
                return {
                    success: true,
                    command: 'npm',
                    args: ['install', '-g', '@qwen-code/qwen-code'],
                    message: 'npm install -g @qwen-code/qwen-code'
                }
            case 'codex':
                return {
                    success: true,
                    command: 'npm',
                    args: ['install', '-g', '@openai/codex-cli'],
                    message: 'npm install -g @openai/codex-cli'
                }
            case 'gemini':
                return {
                    success: true,
                    command: 'npm',
                    args: ['install', '-g', '@google/gemini-cli'],
                    message: 'npm install -g @google/gemini-cli'
                }
            case 'codebuddy':
                return {
                    success: true,
                    command: 'npm',
                    args: ['install', '-g', '@tencent-ai/codebuddy-code@beta'],
                    message: 'npm install -g @tencent-ai/codebuddy-code@beta'
                }
            default:
                return { success: false, message: `# 请查阅 ${agent} 的官方安装文档` }
        }
    }
    executeCommand(command, args, env, log) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const useShell = process.platform === 'win32'
                const child = (0, child_process_1.spawn)(command, args, {
                    stdio: 'inherit',
                    env,
                    shell: useShell
                })
                child.on('close', (code) => {
                    if (code === 0) {
                        resolve()
                    } else {
                        const errorMsg = `命令执行失败: ${command} ${args.join(' ')} (退出码: ${code})`
                        log.error(`❌ ${errorMsg}`)
                        if (code === 127) {
                            log.info('💡 命令未找到，请检查是否正确安装')
                            log.info(`📦 安装命令: ${this.getInstallCommand(command).message}`)
                        } else if (code === 1) {
                            log.info('💡 可能是参数错误或配置问题')
                            log.info('🔧 请检查 API 密钥、模型名称等配置是否正确')
                        }
                        if (command === 'ccr') {
                            log.info(`🔧 请前往 ${const_1.CLAUDE_CODE_ROUTER_LOG_PATH} 查看日志`)
                        }
                        reject(new Error(errorMsg))
                    }
                })
                child.on('error', (err) => {
                    const errorMsg = `启动失败: ${command} (${err.message})`
                    log.error(`❌ ${errorMsg}`)
                    if (err.message.includes('ENOENT')) {
                        log.info('💡 命令不存在，请先安装对应的 AI CLI 工具')
                        log.info(`📦 安装命令: ${this.getInstallCommand(command).message}`)
                    } else if (err.message.includes('EACCES')) {
                        log.info('💡 权限不足，请检查文件权限或使用管理员权限')
                    }
                    reject(new Error(errorMsg))
                })
            })
        })
    }
    isToolAvailable(command) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                const child = (0, child_process_1.spawn)(command, ['--version'], {
                    stdio: 'pipe',
                    shell: true
                })
                child.on('close', (code) => {
                    resolve(code === 0)
                })
                child.on('error', () => {
                    resolve(false)
                })
            })
        })
    }
    validateAgentConfig(agent, agentConfig, log) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!agentConfig) {
                log.error('❌ Agent 配置为空')
                return false
            }
            const validateResult = (0, const_1.getAgentConfigValidator)(agent)(agentConfig)
            if (validateResult.success === true) {
                log.debug('✅ Agent 配置验证通过')
                return true
            } else {
                log.error(`❌ ${agent} 配置无效: ${validateResult.error}`)
                return false
            }
        })
    }
    executeAgentWithConfig(agent, agentConfig, additionalArgs, log) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (agent) {
                case const_1.CLAUDE.value:
                    try {
                        if (agentConfig.type === 'cloudbase') {
                            return yield this.executeClaudeCloudbaseAgent(
                                agentConfig,
                                additionalArgs,
                                log
                            )
                        } else if (agentConfig.type === 'custom') {
                            return yield this.executeClaudeAgent(agentConfig, additionalArgs, log)
                        } else {
                            return yield this.executeNoneClaudeAgent(additionalArgs, log)
                        }
                    } catch (_) {
                        ;(0, claudeWindows_1.claudeWindowsCheck)(log)
                        return process.exit(1)
                    }
                case const_1.QWEN.value:
                    if (agentConfig.type === 'cloudbase') {
                        return yield this.executeQwenCloudbaseAgent(
                            agentConfig,
                            additionalArgs,
                            log
                        )
                    } else if (agentConfig.type === 'custom') {
                        return yield this.executeQwenAgent(agentConfig, additionalArgs, log)
                    } else {
                        return yield this.executeNoneQwenAgent(additionalArgs, log)
                    }
                case const_1.CODEX.value:
                    if (agentConfig.type === 'cloudbase') {
                        return yield this.executeCodexCloudbaseAgent(
                            agentConfig,
                            additionalArgs,
                            log
                        )
                    } else if (agentConfig.type === 'custom') {
                        return yield this.executeCodexAgent(agentConfig, additionalArgs, log)
                    } else {
                        return yield this.executeNoneCodexAgent(additionalArgs, log)
                    }
                case const_1.AIDER.value:
                    if (agentConfig.type === 'cloudbase') {
                        return yield this.executeAiderCloudbaseAgent(
                            agentConfig,
                            additionalArgs,
                            log
                        )
                    } else {
                        return yield this.executeAiderAgent(agentConfig, additionalArgs, log)
                    }
                case const_1.CURSOR.value:
                    return yield this.executeNoneCursorAgent(additionalArgs, log)
                case const_1.CODEBUDDY.value:
                    if (agentConfig.type === 'custom') {
                        return yield this.executeCodebuddyAgent(agentConfig, additionalArgs, log)
                    } else {
                        return yield this.executeNoneCodebuddyAgent(additionalArgs, log)
                    }
                default:
                    throw new Error(`不支持的 AI 工具: ${agent}`)
            }
        })
    }
    executeClaudeAgent({ apiKey, baseUrl, model }, additionalArgs, log) {
        return __awaiter(this, void 0, void 0, function* () {
            ;(0, nodeVersion_1.ensureNodeVersion)('v18.0.0', log)
            yield this.ensureClaudeCode(log)
            yield this.executeCommand(
                'claude',
                additionalArgs,
                Object.assign(Object.assign({}, process.env), {
                    ANTHROPIC_AUTH_TOKEN: apiKey,
                    ANTHROPIC_BASE_URL: baseUrl,
                    ANTHROPIC_MODEL: model
                }),
                log
            )
        })
    }
    executeNoneClaudeAgent(additionalArgs, log) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureClaudeCode(log)
            yield this.executeCommand('claude', additionalArgs, Object.assign({}, process.env), log)
        })
    }
    executeQwenAgent({ apiKey, baseUrl, model }, additionalArgs, log) {
        return __awaiter(this, void 0, void 0, function* () {
            ;(0, nodeVersion_1.ensureNodeVersion)('v20.0.0', log)
            yield this.ensureQwenCode(log)
            yield this.executeCommand(
                'qwen',
                additionalArgs,
                Object.assign(Object.assign({}, process.env), {
                    OPENAI_API_KEY: apiKey,
                    OPENAI_BASE_URL: baseUrl,
                    OPENAI_MODEL: model
                }),
                log
            )
        })
    }
    executeNoneQwenAgent(additionalArgs, log) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureQwenCode(log)
            yield this.executeCommand('qwen', additionalArgs, Object.assign({}, process.env), log)
        })
    }
    executeQwenCloudbaseAgent({ provider, model }, additionalArgs, log) {
        return __awaiter(this, void 0, void 0, function* () {
            ;(0, nodeVersion_1.ensureNodeVersion)('v20.0.0', log)
            yield this.ensureQwenCode(log)
            const _envId = yield (0, config_1.createConfigParser)().get('envId')
            yield (0, auth_1.checkLogin)()
            const credential = yield (0, utils_1.getCredential)({}, {})
            const envId = yield (0, env_1.ensureValidEnv)(_envId, log)
            const accessToken = yield (0, utils_1.rawFetchAccessToken)({
                envId,
                secretId: credential.secretId,
                secretKey: credential.secretKey,
                token: credential.token
            })
            if (!accessToken.access_token) {
                log.error(
                    `获取云开发 Access Token 失败，请运行 tcb login 后再重试，${JSON.stringify(accessToken)}`
                )
                process.exit(1)
            }
            const baseUrl = `https://${envId}.api.tcloudbasegateway.com/v1/ai/${provider}`
            const apiKey = accessToken.access_token
            yield this.executeCommand(
                'qwen',
                additionalArgs,
                Object.assign(Object.assign({}, process.env), {
                    OPENAI_API_KEY: apiKey,
                    OPENAI_BASE_URL: baseUrl,
                    OPENAI_MODEL: model
                }),
                log
            )
        })
    }
    executeClaudeCloudbaseAgent({ provider, model, transformer }, additionalArgs, log) {
        return __awaiter(this, void 0, void 0, function* () {
            ;(0, nodeVersion_1.ensureNodeVersion)('v18.19.0', log)
            yield this.ensureClaudeCodeRouter(log)
            yield this.ensureClaudeCode(log)
            yield this.configureClaudeCodeRouter(provider, model, transformer, log)
            yield this.restartClaudeCodeRouter(log)
            yield this.executeCommand(
                'ccr',
                ['code', ...additionalArgs],
                Object.assign({}, process.env),
                log
            )
        })
    }
    restartClaudeCodeRouter(log) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.executeCommand('ccr', ['restart'], process.env, log)
            } catch (e) {
                log.error('执行 ccr restart 失败，尝试执行 ccr stop && ccr start')
                yield this.executeCommand('ccr', ['stop'], process.env, log)
                this.executeCommand('ccr', ['start'], process.env, log)
                const max = 3
                let current = 0
                while (current < max) {
                    current++
                    if (current > max) {
                        throw new Error(
                            `ccr 重启完成失败，可前往 ${const_1.CLAUDE_CODE_ROUTER_LOG_PATH} 查看日志`
                        )
                    }
                    log.info(`${current}/${max}等待 ccr 重启完成...`)
                    const isRunning = yield this.isClaudeCodeRouterRunning()
                    if (isRunning) {
                        log.info('ccr 重启完成')
                        break
                    }
                }
            }
        })
    }
    isClaudeCodeRouterRunning() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                const child = (0, child_process_1.spawn)('ccr', ['status'], {
                    stdio: 'pipe',
                    env: process.env,
                    shell: process.platform === 'win32'
                })
                child.stdout.on('data', (data) => {
                    const str = data.toString()
                    if (str.includes('Status: Running')) {
                        resolve(true)
                        child.kill()
                    }
                })
                setTimeout(() => {
                    resolve(false)
                    child.kill()
                }, 3000)
            })
        })
    }
    configureClaudeCodeRouter(provider, model, transformer, log) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield Promise.resolve().then(() => __importStar(require('fs-extra')))
            const _envId = yield (0, config_1.createConfigParser)().get('envId')
            yield (0, auth_1.checkLogin)()
            const credential = yield (0, utils_1.getCredential)({}, {})
            const envId = yield (0, env_1.ensureValidEnv)(_envId, log)
            const accessToken = yield (0, utils_1.rawFetchAccessToken)({
                envId,
                secretId: credential.secretId,
                secretKey: credential.secretKey,
                token: credential.token
            })
            if (!accessToken.access_token) {
                log.error(
                    `获取云开发 Access Token 失败，请运行 tcb login 后再重试，${JSON.stringify(accessToken)}`
                )
                process.exit(1)
            }
            const cloudbaseProvider = {
                name: 'cloudbase',
                api_base_url: `https://${envId}.api.tcloudbasegateway.com/v1/ai/${provider}/chat/completions`,
                api_key: accessToken.access_token,
                models: [model]
            }
            if (transformer && transformer.trim().length > 0) {
                cloudbaseProvider.transformer = { use: [transformer] }
            }
            yield fs.ensureFile(const_1.CLAUDE_CODE_ROUTER_CONFIG_PATH)
            const claudeCodeRouterConfig = yield fs.readFile(
                const_1.CLAUDE_CODE_ROUTER_CONFIG_PATH,
                'utf-8'
            )
            if (claudeCodeRouterConfig.trim().length === 0) {
                log.debug('🛠️ claude-code-router 配置为空，写入 Cloudbase 配置...')
                yield fs.writeJson(const_1.CLAUDE_CODE_ROUTER_CONFIG_PATH, {
                    Providers: [cloudbaseProvider]
                })
                log.debug('✅ claude-code-router 配置完成')
            } else {
                const config = safeParseJson(claudeCodeRouterConfig)
                if (!config) {
                    const { shouldOverwrite } = yield inquirer_1.default.prompt([
                        {
                            type: 'confirm',
                            name: 'shouldOverwrite',
                            message: `claude-code-router 配置文件非合法 JSON ，是否覆盖？ ${(0, const_1.getBooleanHint)()}`
                        }
                    ])
                    if (shouldOverwrite) {
                        yield fs.writeJson(
                            const_1.CLAUDE_CODE_ROUTER_CONFIG_PATH,
                            {
                                Providers: [cloudbaseProvider]
                            },
                            { spaces: 2 }
                        )
                        log.debug('✅ claude-code-router 配置完成')
                    } else {
                        log.error('❌ claude-code-router 配置文件非合法 JSON ，请手动修复')
                        process.exit(1)
                    }
                }
                if (typeof config !== 'object' || config === null) {
                    log.error('❌ 未知 claude-code-router 配置文件格式请手动修复')
                    process.exit(1)
                }
                if (!('Providers' in config)) {
                    config.Providers = [cloudbaseProvider]
                }
                if (!Array.isArray(config.Providers)) {
                    log.error('❌ claude-code-router 配置文件 Providers 字段非数组类型，请手动修复')
                    process.exit(1)
                }
                const providers = config.Providers
                const index = providers.findIndex(
                    (p) =>
                        typeof p === 'object' &&
                        (p === null || p === void 0 ? void 0 : p.name) === 'cloudbase'
                )
                if (index !== -1) {
                    providers[index] = cloudbaseProvider
                } else {
                    providers.push(cloudbaseProvider)
                }
                if (
                    !('Router' in config) ||
                    typeof config.Router !== 'object' ||
                    config.Router === null
                ) {
                    config.Router = {}
                }
                config.Router.default = `cloudbase,${model}`
                config.Log = true
                yield fs.writeJson(const_1.CLAUDE_CODE_ROUTER_CONFIG_PATH, config, { spaces: 2 })
                log.debug('✅ claude-code-router 配置完成')
            }
        })
    }
    parseArgs(args) {
        return args.filter((arg) => typeof arg === 'string' && arg.trim().length > 0)
    }
    ensureClaudeCodeRouter(log) {
        return __awaiter(this, void 0, void 0, function* () {
            const isAvailable = yield new Promise((resolve) => {
                const child = (0, child_process_1.spawn)('ccr', ['--version'], {
                    stdio: 'pipe',
                    shell: true
                })
                child.stdout.on('data', (data) => {
                    data.toString().includes('Usage: ccr [command]') && resolve(true)
                })
                child.on('close', (code) => {
                    resolve(code === 0)
                })
                child.on('error', () => {
                    resolve(false)
                })
            })
            if (isAvailable) {
                log.debug('claude code router 已安装!')
            } else {
                const { shouldInstall } = yield inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'shouldInstall',
                        message: `AI 开发缺少 claude code router 依赖，是否安装? ${(0, const_1.getBooleanHint)(true)}`
                    }
                ])
                if (shouldInstall) {
                    yield this.executeCommand(
                        'npm',
                        ['install', '-g', '@musistudio/claude-code-router'],
                        process.env,
                        log
                    )
                    log.info('✅ claude-code-router 安装完成')
                } else {
                    log.info('❌ claude code router 未安装，请手动安装')
                    process.exit(1)
                }
            }
        })
    }
    ensureClaudeCode(log) {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.isToolAvailable('claude')) {
                log.debug('claude code 已安装!')
            } else {
                const { shouldInstall } = yield inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'shouldInstall',
                        message: `AI 开发缺少 claude code 依赖，是否安装? ${(0, const_1.getBooleanHint)(true)}`
                    }
                ])
                if (shouldInstall) {
                    const platform = process.platform
                    if (platform === 'win32') {
                        yield this.executeCommand(
                            'npm',
                            ['install', '-g', '@anthropic-ai/claude-code'],
                            process.env,
                            log
                        )
                    } else {
                        try {
                            yield this.executeCommand(
                                'sh',
                                ['-c', 'curl -fsSL https://claude.ai/install.sh | bash'],
                                process.env,
                                log
                            )
                        } catch (error) {
                            log.warn('⚠️ curl 安装失败，尝试使用 npm 安装...')
                            try {
                                yield this.executeCommand(
                                    'npm',
                                    ['install', '-g', '@anthropic-ai/claude-code'],
                                    process.env,
                                    log
                                )
                            } catch (npmError) {
                                log.error('❌ claude code 安装失败')
                                log.error('请手动安装 claude code:')
                                log.error(
                                    `📖 安装文档: ${(0, output_1.genClickableLink)('https://docs.anthropic.com/en/docs/claude-code/setup')}`
                                )
                                process.exit(1)
                            }
                        }
                    }
                    log.info('✅ claude code 安装完成')
                } else {
                    log.info('❌ claude code 未安装，请手动安装')
                    log.info(
                        `📖 安装文档: ${(0, output_1.genClickableLink)('https://docs.anthropic.com/en/docs/claude-code/setup')}`
                    )
                    process.exit(1)
                }
            }
        })
    }
    ensureQwenCode(log) {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.isToolAvailable('qwen')) {
                log.debug('qwen code 已安装!')
            } else {
                const { shouldInstall } = yield inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'shouldInstall',
                        message: `AI 开发缺少 qwen code 依赖，是否安装? ${(0, const_1.getBooleanHint)(true)}`
                    }
                ])
                if (shouldInstall) {
                    yield this.executeCommand(
                        'npm',
                        ['install', '-g', '@qwen-code/qwen-code'],
                        process.env,
                        log
                    )
                    log.info('✅ qwen code 安装完成')
                } else {
                    log.info('❌ qwen code 未安装，请手动安装')
                    process.exit(1)
                }
            }
        })
    }
    executeCodexAgent({ apiKey, baseUrl, model }, additionalArgs, log) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCodexCode(log)
            const codexArgs = [
                ...(model ? ['--config', `model=${model}`] : []),
                '--config',
                'model_providers.custom.name=Custom OpenAI',
                ...(baseUrl ? ['--config', `model_providers.custom.base_url=${baseUrl}`] : []),
                '--config',
                'model_providers.custom.env_key=OPENAI_API_KEY',
                '--config',
                'model_provider=custom',
                ...additionalArgs
            ]
            yield this.executeCommand(
                'codex',
                codexArgs,
                Object.assign(Object.assign({}, process.env), { OPENAI_API_KEY: apiKey }),
                log
            )
        })
    }
    executeNoneCodexAgent(additionalArgs, log) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCodexCode(log)
            yield this.executeCommand('codex', additionalArgs, Object.assign({}, process.env), log)
        })
    }
    executeCodexCloudbaseAgent({ provider, model }, additionalArgs, log) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCodexCode(log)
            const _envId = yield (0, config_1.createConfigParser)().get('envId')
            yield (0, auth_1.checkLogin)()
            const credential = yield (0, utils_1.getCredential)({}, {})
            const envId = yield (0, env_1.ensureValidEnv)(_envId, log)
            const accessToken = yield (0, utils_1.rawFetchAccessToken)({
                envId,
                secretId: credential.secretId,
                secretKey: credential.secretKey,
                token: credential.token
            })
            if (!accessToken.access_token) {
                log.error(
                    `获取云开发 Access Token 失败，请运行 tcb login 后再重试，${JSON.stringify(accessToken)}`
                )
                process.exit(1)
            }
            const baseUrl = `https://${envId}.api.tcloudbasegateway.com/v1/ai/${provider}`
            const apiKey = accessToken.access_token
            const codexArgs = [
                '--config',
                `model=${model}`,
                '--config',
                'model_providers.cloudbase.name=CloudBase AI',
                '--config',
                `model_providers.cloudbase.base_url=${baseUrl}`,
                '--config',
                'model_providers.cloudbase.env_key=CLOUDBASE_ACCESS_TOKEN',
                '--config',
                'model_provider=cloudbase',
                ...additionalArgs
            ]
            yield this.executeCommand(
                'codex',
                codexArgs,
                Object.assign(Object.assign({}, process.env), { CLOUDBASE_ACCESS_TOKEN: apiKey }),
                log
            )
        })
    }
    executeNoneCursorAgent(additionalArgs, log) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCursor(log)
            yield this.executeCommand(
                'cursor-agent',
                additionalArgs,
                Object.assign({}, process.env),
                log
            )
        })
    }
    ensureCursor(log) {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.isToolAvailable('cursor-agent')) {
                log.debug('Cursor CLI 已安装!')
            } else {
                const { shouldInstall } = yield inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'shouldInstall',
                        message: `AI 开发缺少 Cursor CLI 依赖，是否安装? ${(0, const_1.getBooleanHint)(true)}`
                    }
                ])
                if (shouldInstall) {
                    log.info('正在安装 Cursor CLI...')
                    yield this.executeCommand(
                        'sh',
                        ['-c', 'curl https://cursor.com/install -fsS | bash'],
                        process.env,
                        log
                    )
                    log.info('✅ Cursor CLI 安装完成')
                } else {
                    log.info('❌ Cursor CLI 未安装，请手动安装')
                    process.exit(1)
                }
            }
        })
    }
    ensureCodexCode(log) {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.isToolAvailable('codex')) {
                log.debug('codex 已安装!')
            } else {
                const { shouldInstall } = yield inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'shouldInstall',
                        message: `AI 开发缺少 codex 依赖，是否安装? ${(0, const_1.getBooleanHint)(true)}`
                    }
                ])
                if (shouldInstall) {
                    yield this.executeCommand(
                        'npm',
                        ['install', '-g', '@openai/codex'],
                        process.env,
                        log
                    )
                    log.info('✅ codex 安装完成')
                } else {
                    log.info('❌ codex 未安装，请手动安装')
                    process.exit(1)
                }
            }
        })
    }
    executeAiderAgent(config, additionalArgs, log) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureAider(log)
            const { apiKey, baseUrl, model } = config
            const aiderArgs = ['--model', `openai/${model}`, ...additionalArgs]
            const env = Object.assign(Object.assign({}, process.env), {
                OPENAI_API_KEY: apiKey,
                OPENAI_API_BASE: baseUrl
            })
            yield this.executeCommand('aider', aiderArgs, env, log)
        })
    }
    executeAiderCloudbaseAgent(config, additionalArgs, log) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureAider(log)
            const { provider, model } = config
            const _envId = yield (0, config_1.createConfigParser)().get('envId')
            yield (0, auth_1.checkLogin)()
            const credential = yield (0, utils_1.getCredential)({}, {})
            const envId = yield (0, env_1.ensureValidEnv)(_envId, log)
            const accessToken = yield (0, utils_1.rawFetchAccessToken)({
                envId,
                secretId: credential.secretId,
                secretKey: credential.secretKey,
                token: credential.token
            })
            if (!accessToken.access_token) {
                log.error(
                    `获取云开发 Access Token 失败，请运行 tcb login 后再重试，${JSON.stringify(accessToken)}`
                )
                process.exit(1)
            }
            const baseUrl = `https://${envId}.api.tcloudbasegateway.com/v1/ai/${provider}`
            const apiKey = accessToken.access_token
            const aiderArgs = ['--model', `openai/${model}`, ...additionalArgs]
            const env = Object.assign(Object.assign({}, process.env), {
                OPENAI_API_KEY: apiKey,
                OPENAI_API_BASE: baseUrl
            })
            yield this.executeCommand('aider', aiderArgs, env, log)
        })
    }
    ensureAider(log) {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.isToolAvailable('aider')) {
                log.debug('aider 已安装!')
            } else {
                const { shouldInstall } = yield inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'shouldInstall',
                        message: `AI 开发缺少 aider 依赖，是否安装? ${(0, const_1.getBooleanHint)(true)}`
                    }
                ])
                if (shouldInstall) {
                    log.info('正在安装 aider...')
                    const platform = process.platform
                    if (platform === 'win32') {
                        yield this.executeCommand(
                            'powershell',
                            ['-c', 'irm https://aider.chat/install.ps1 | iex'],
                            process.env,
                            log
                        )
                    } else {
                        yield this.executeCommand(
                            'sh',
                            ['-c', 'curl -LsSf https://aider.chat/install.sh | sh'],
                            process.env,
                            log
                        )
                    }
                    log.info('✅ aider 安装完成')
                } else {
                    log.info('❌ aider 未安装，请手动安装')
                    process.exit(1)
                }
            }
        })
    }
    modifyMCPConfigs(extractDir, log) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield Promise.resolve().then(() => __importStar(require('fs-extra')))
            const path = yield Promise.resolve().then(() => __importStar(require('path')))
            try {
                log.info('🔧 正在修改 MCP 配置文件...')
                for (const [, files] of Object.entries(IDE_FILE_MAPPINGS)) {
                    for (const descriptor of files) {
                        if (!descriptor.isMcpConfig) continue
                        const filePath = path.join(extractDir, descriptor.path)
                        if (yield fs.pathExists(filePath)) {
                            const format = inferConfigFormat(descriptor.path)
                            if (format === 'json') {
                                yield this.modifyMCPJsonFile(filePath, log)
                            } else if (format === 'toml') {
                                yield this.modifyMCPTomlFile(filePath, log)
                            }
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
            const fs = yield Promise.resolve().then(() => __importStar(require('fs-extra')))
            try {
                const content = yield fs.readFile(filePath, 'utf-8')
                const config = JSON.parse(content)
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
                        if (
                            argsStr.includes('npm-global-exec@latest') &&
                            argsStr.includes('@cloudbase/cloudbase-mcp@latest')
                        ) {
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
                    yield fs.writeJson(filePath, modifiedConfig, { spaces: 2 })
                    log.debug(`✅ 已修改 ${filePath}`)
                }
            } catch (error) {
                log.warn(`⚠️  修改配置文件 ${filePath} 失败: ${error.message}`)
            }
        })
    }
    modifyMCPTomlFile(filePath, log) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield Promise.resolve().then(() => __importStar(require('fs-extra')))
            const toml = yield Promise.resolve().then(() => __importStar(require('toml')))
            try {
                const content = yield fs.readFile(filePath, 'utf-8')
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
                    yield fs.writeFile(filePath, tomlString, 'utf-8')
                    log.debug(`✅ 已修改 ${filePath}`)
                }
            } catch (error) {
                log.warn(`⚠️  修改配置文件 ${filePath} 失败: ${error.message}`)
            }
        })
    }
    mergeMcpConfig(entry, destPath, format, log) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield Promise.resolve().then(() => __importStar(require('fs-extra')))
            const path = yield Promise.resolve().then(() => __importStar(require('path')))
            const incomingStr = (yield entry.buffer()).toString('utf8')
            const deepMerge = (target, source) => {
                if (
                    typeof target !== 'object' ||
                    typeof source !== 'object' ||
                    !target ||
                    !source
                ) {
                    return target
                }
                const result = Array.isArray(target)
                    ? [...target]
                    : Object.assign(Object.assign({}, source), target)
                for (const key of Object.keys(source)) {
                    if (
                        key in target &&
                        typeof target[key] === 'object' &&
                        typeof source[key] === 'object'
                    ) {
                        result[key] = deepMerge(target[key], source[key])
                    }
                }
                return result
            }
            yield fs.ensureDir(path.dirname(destPath))
            if (format === 'json') {
                const incomingObj = JSON.parse(incomingStr)
                if (yield fs.pathExists(destPath)) {
                    const existingObj = yield fs.readJson(destPath)
                    const merged = deepMerge(existingObj, incomingObj)
                    yield fs.writeJson(destPath, merged, { spaces: 2 })
                } else {
                    yield fs.writeJson(destPath, incomingObj, { spaces: 2 })
                }
                return
            }
            const toml = yield Promise.resolve().then(() => __importStar(require('toml')))
            const incomingObj = toml.parse(incomingStr)
            if (yield fs.pathExists(destPath)) {
                const existingStr = yield fs.readFile(destPath, 'utf-8')
                const existingObj = toml.parse(existingStr)
                const merged = deepMerge(existingObj, incomingObj)
                const out = this.objectToToml(merged)
                yield fs.writeFile(destPath, out, 'utf-8')
            } else {
                const out = this.objectToToml(incomingObj)
                yield fs.writeFile(destPath, out, 'utf-8')
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
    executeCodebuddyAgent({ apiKey }, additionalArgs, log) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCodebuddy(log)
            yield this.executeCommand(
                'codebuddy',
                additionalArgs,
                Object.assign(
                    Object.assign({}, process.env),
                    apiKey && { CODEBUDDY_API_KEY: apiKey }
                ),
                log
            )
        })
    }
    executeNoneCodebuddyAgent(additionalArgs, log) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCodebuddy(log)
            yield this.executeCommand(
                'codebuddy',
                additionalArgs,
                Object.assign({}, process.env),
                log
            )
        })
    }
    ensureCodebuddy(log) {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.isToolAvailable('codebuddy')) {
                log.debug('codebuddy 已安装!')
            } else {
                const { shouldInstall } = yield inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'shouldInstall',
                        message: `AI 开发缺少 codebuddy 依赖，是否安装? ${(0, const_1.getBooleanHint)(true)}`
                    }
                ])
                if (shouldInstall) {
                    yield this.executeCommand(
                        'npm',
                        ['install', '-g', '@tencent-ai/codebuddy-code@beta'],
                        process.env,
                        log
                    )
                    log.info('✅ codebuddy 安装完成')
                } else {
                    log.info('❌ codebuddy 未安装，请手动安装')
                    log.info('📦 安装命令: npm install -g @tencent-ai/codebuddy-code@beta')
                    process.exit(1)
                }
            }
        })
    }
}
exports.AICommandRouter = AICommandRouter
function safeParseJson(json) {
    try {
        return JSON.parse(json)
    } catch (_) {
        return null
    }
}
