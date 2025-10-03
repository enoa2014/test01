'use strict'
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
exports.AIConfigManager =
    exports.createConfigParser =
    exports.TOOLKIT_CONFIGS =
    exports.isValidAgent =
    exports.CONFIG_NOT_FOUND =
        void 0
const error_1 = require('../../error')
const fs_extra_1 = __importDefault(require('fs-extra'))
const envLocalManager_1 = require('./envLocalManager')
const toolbox_1 = require('@cloudbase/toolbox')
const const_1 = require('./const')
exports.CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND'
const notFoundError = () => {
    throw new error_1.CloudBaseError('AI 配置未找到，请运行 tcb ai --setup 进行配置', {
        code: exports.CONFIG_NOT_FOUND
    })
}
function isValidAgent(agent) {
    return [
        const_1.CLAUDE,
        const_1.QWEN,
        const_1.CODEX,
        const_1.AIDER,
        const_1.CURSOR,
        const_1.CODEBUDDY
    ].some((x) => x.value === agent)
}
exports.isValidAgent = isValidAgent
exports.TOOLKIT_CONFIGS = {
    [const_1.CLAUDE.value]: {
        mcp: '.mcp.json',
        rules: 'CLAUDE.md'
    },
    [const_1.CODEBUDDY.value]: {
        config: '.env.local',
        mcp: '.mcp.json',
        rules: 'CODEBUDDY.md'
    },
    [const_1.QWEN.value]: {
        config: '.env.local',
        mcp: '.qwen/settings.json',
        rules: '.qwen/QWEN.md'
    },
    [const_1.CODEX.value]: {
        config: '.env.local',
        mcp: '.codex/config.toml',
        rules: 'AGENTS.md'
    },
    [const_1.AIDER.value]: {
        config: '.env.local'
    },
    [const_1.CURSOR.value]: {
        config: '.cursor/mcp.json',
        rules: '.cursor/rules/cloudbase-rules.mdc'
    }
}
function createConfigParser() {
    return new toolbox_1.ConfigParser({ configPath: const_1.CONFIG_PATH })
}
exports.createConfigParser = createConfigParser
class AIConfigManager {
    constructor() {
        this.envLocalManager = new envLocalManager_1.EnvLocalManager()
    }
    loadConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            const parser = createConfigParser()
            const config = yield parser.get('ai')
            !config && notFoundError()
            return config
        })
    }
    isConfigured() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const config = yield this.loadConfig()
                return Object.keys(config.agents).length > 0
            } catch (_a) {
                return false
            }
        })
    }
    getAgentConfig(agent) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = yield this.loadConfig()
            return config.agents[agent] || null
        })
    }
    resetConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield Promise.all([
                    new envLocalManager_1.EnvLocalManager().removeAIConfig(),
                    createConfigParser().update('ai', {})
                ])
            } catch (error) {
                throw new error_1.CloudBaseError(
                    '重置 AI 配置失败，请手动删除 `.env.local`、`cloudbaserc.json` 文件中的 AI 配置部分，或重新运行 tcb ai --setup',
                    { original: error }
                )
            }
        })
    }
    checkToolkitConfig(agent) {
        return __awaiter(this, void 0, void 0, function* () {
            const toolkitConfig = exports.TOOLKIT_CONFIGS[agent]
            if (!toolkitConfig) {
                return { hasConfig: false, hasMcp: false, hasRules: false, missingFiles: [] }
            }
            const results = {
                hasConfig: false,
                hasMcp: false,
                hasRules: false,
                missingFiles: []
            }
            if ('mcp' in toolkitConfig) {
                results.hasMcp = yield fs_extra_1.default.pathExists(toolkitConfig.mcp)
                results.hasConfig = results.hasMcp
                if (!results.hasMcp) {
                    results.missingFiles.push(toolkitConfig.mcp)
                }
            } else if ('config' in toolkitConfig) {
                results.hasConfig = yield fs_extra_1.default.pathExists(toolkitConfig.config)
                if (!results.hasConfig) {
                    results.missingFiles.push(toolkitConfig.config)
                }
            }
            if (toolkitConfig.rules) {
                results.hasRules = yield fs_extra_1.default.pathExists(toolkitConfig.rules)
                if (!results.hasRules) {
                    results.missingFiles.push(toolkitConfig.rules)
                }
            }
            return results
        })
    }
    updateEnvId(envId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.updateConfig('envId', envId, 'ENV_ID')
            yield fs_extra_1.default.ensureFile(const_1.CLOUDBASE_MCP_CONFIG_PATH)
            yield fs_extra_1.default.writeJson(
                const_1.CLOUDBASE_MCP_CONFIG_PATH,
                {
                    envId,
                    updatedAt: new Date().toISOString(),
                    version: '1.0'
                },
                { spaces: 2 }
            )
        })
    }
    updateDefaultAgent(agent) {
        return __awaiter(this, void 0, void 0, function* () {
            const configParser = createConfigParser()
            yield configParser.update('ai.defaultAgent', '{{env.AI_DEFAULT_AGENT}}')
            this.envLocalManager.updateDefaultAgent(agent)
        })
    }
    updateClaudeConfig(type, config) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.updateConfig('ai.agents.claude', {})
            yield this.updateConfig('ai.agents.claude.type', type)
            if (type === 'custom') {
                if (config.baseUrl) {
                    yield this.updateConfig(
                        'ai.agents.claude.baseUrl',
                        config.baseUrl,
                        'AI_CLAUDE_BASE_URL'
                    )
                }
                if (config.apiKey) {
                    yield this.updateConfig(
                        'ai.agents.claude.apiKey',
                        config.apiKey,
                        'AI_CLAUDE_API_KEY'
                    )
                }
                if (config.model) {
                    yield this.updateConfig(
                        'ai.agents.claude.model',
                        config.model,
                        'ANTHROPIC_MODEL'
                    )
                }
            } else if (type === 'cloudbase') {
                if (config.provider) {
                    yield this.updateConfig('ai.agents.claude.provider', config.provider)
                }
                if (config.model) {
                    yield this.updateConfig('ai.agents.claude.model', config.model)
                }
                if (config.transformer) {
                    yield this.updateConfig('ai.agents.claude.transformer', config.transformer)
                }
            }
        })
    }
    updateQwenConfig(type, config) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.updateConfig('ai.agents.qwen', {})
            yield this.updateConfig('ai.agents.qwen.type', type)
            if (type === 'custom') {
                if (config.baseUrl) {
                    yield this.updateConfig(
                        'ai.agents.qwen.baseUrl',
                        config.baseUrl,
                        'AI_QWEN_BASE_URL'
                    )
                }
                if (config.apiKey) {
                    yield this.updateConfig(
                        'ai.agents.qwen.apiKey',
                        config.apiKey,
                        'AI_QWEN_API_KEY'
                    )
                }
                if (config.model) {
                    yield this.updateConfig('ai.agents.qwen.model', config.model, 'AI_QWEN_MODEL')
                }
            } else if (type === 'cloudbase') {
                if (config.provider) {
                    yield this.updateConfig('ai.agents.qwen.provider', config.provider)
                }
                if (config.model) {
                    yield this.updateConfig('ai.agents.qwen.model', config.model)
                }
            }
        })
    }
    updateCodexConfig(type, config) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.updateConfig('ai.agents.codex', {})
            yield this.updateConfig('ai.agents.codex.type', type)
            if (type === 'custom') {
                if (config.baseUrl) {
                    yield this.updateConfig(
                        'ai.agents.codex.baseUrl',
                        config.baseUrl,
                        'AI_CODEX_BASE_URL'
                    )
                }
                if (config.apiKey) {
                    yield this.updateConfig(
                        'ai.agents.codex.apiKey',
                        config.apiKey,
                        'AI_CODEX_API_KEY'
                    )
                }
                if (config.model) {
                    yield this.updateConfig('ai.agents.codex.model', config.model, 'AI_CODEX_MODEL')
                }
            } else if (type === 'cloudbase') {
                if (config.provider) {
                    yield this.updateConfig('ai.agents.codex.provider', config.provider)
                }
                if (config.model) {
                    yield this.updateConfig('ai.agents.codex.model', config.model)
                }
            }
        })
    }
    updateAiderConfig(type, config) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.updateConfig('ai.agents.aider', {})
            yield this.updateConfig('ai.agents.aider.type', type)
            if (type === 'custom') {
                if (config.apiKey) {
                    yield this.updateConfig(
                        'ai.agents.aider.apiKey',
                        config.apiKey,
                        'AI_AIDER_API_KEY'
                    )
                }
                if (config.baseUrl) {
                    yield this.updateConfig(
                        'ai.agents.aider.baseUrl',
                        config.baseUrl,
                        'AI_AIDER_BASE_URL'
                    )
                }
                if (config.model) {
                    yield this.updateConfig('ai.agents.aider.model', config.model, 'AI_AIDER_MODEL')
                }
            } else if (type === 'cloudbase') {
                if (config.provider) {
                    yield this.updateConfig('ai.agents.aider.provider', config.provider)
                }
                if (config.model) {
                    yield this.updateConfig('ai.agents.aider.model', config.model)
                }
            }
        })
    }
    updateCursorConfig(type) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.updateConfig('ai.agents.cursor.type', type)
        })
    }
    updateCodebuddyConfig(type, config) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.updateConfig('ai.agents.codebuddy', {})
            yield this.updateConfig('ai.agents.codebuddy.type', type)
            if (type === 'custom') {
                if (config.apiKey) {
                    yield this.updateConfig(
                        'ai.agents.codebuddy.apiKey',
                        config.apiKey,
                        'CODEBUDDY_API_KEY'
                    )
                }
            }
        })
    }
    updateConfig(key, value, env) {
        return __awaiter(this, void 0, void 0, function* () {
            const configParser = createConfigParser()
            if (env) {
                this.envLocalManager.setEnvLocal(env, value)
                yield configParser.update(key, `{{env.${env}}}`)
            } else {
                yield configParser.update(key, value)
            }
        })
    }
}
exports.AIConfigManager = AIConfigManager
