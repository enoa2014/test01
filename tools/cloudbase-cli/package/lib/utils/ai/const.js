"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIST_HINT = exports.getBooleanHint = exports.getDefaultModelByBaseUrl = exports.BASE_URL_MODEL_MAPPING = exports.getAgentConfigValidator = exports.getDefaultConfig = exports.CLOUDBASE_PROVIDERS = exports.AGENTS = exports.NONE = exports.CODEBUDDY = exports.CURSOR = exports.AIDER = exports.CODEX = exports.QWEN = exports.CLAUDE = exports.DEFAULT_CONFIG = exports.CLOUDBASE_MCP_CONFIG_PATH = exports.CLAUDE_CODE_ROUTER_LOGS_DIR_PATH = exports.CLAUDE_CODE_ROUTER_LOG_PATH = exports.CLAUDE_CODE_ROUTER_CONFIG_PATH = exports.ENV_LOCAL_PATH = exports.CONFIG_PATH = void 0;
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const v3_1 = __importDefault(require("zod/v3"));
exports.CONFIG_PATH = path_1.default.join(process.cwd(), 'cloudbaserc.json');
exports.ENV_LOCAL_PATH = path_1.default.join(process.cwd(), '.env.local');
exports.CLAUDE_CODE_ROUTER_CONFIG_PATH = path_1.default.join(os_1.default.homedir(), '.claude-code-router', 'config.json');
exports.CLAUDE_CODE_ROUTER_LOG_PATH = path_1.default.join(os_1.default.homedir(), '.claude-code-router', 'claude-code-router.log');
exports.CLAUDE_CODE_ROUTER_LOGS_DIR_PATH = path_1.default.join(os_1.default.homedir(), '.claude-code-router', 'logs');
exports.CLOUDBASE_MCP_CONFIG_PATH = path_1.default.join(os_1.default.homedir(), '.cloudbase-env-id');
exports.DEFAULT_CONFIG = `{
  "envId": "{{env.ENV_ID}}"
}`;
exports.CLAUDE = {
    name: 'Claude Code',
    value: 'claude',
    configSchema: v3_1.default.discriminatedUnion('type', [
        v3_1.default.object({
            type: v3_1.default.literal('none')
        }),
        v3_1.default.object({
            type: v3_1.default.literal('custom'),
            baseUrl: v3_1.default.string(),
            apiKey: v3_1.default.string(),
            model: v3_1.default.string()
        }),
        v3_1.default.object({
            type: v3_1.default.literal('cloudbase'),
            provider: v3_1.default.string(),
            model: v3_1.default.string(),
            transformer: v3_1.default.string().optional()
        })
    ])
};
exports.QWEN = {
    name: 'Qwen Code',
    value: 'qwen',
    configSchema: v3_1.default.discriminatedUnion('type', [
        v3_1.default.object({
            type: v3_1.default.literal('none')
        }),
        v3_1.default.object({
            type: v3_1.default.literal('custom'),
            baseUrl: v3_1.default.string(),
            apiKey: v3_1.default.string(),
            model: v3_1.default.string()
        }),
        v3_1.default.object({
            type: v3_1.default.literal('cloudbase'),
            provider: v3_1.default.string(),
            model: v3_1.default.string()
        })
    ])
};
exports.CODEX = {
    name: 'OpenAI Codex',
    value: 'codex',
    configSchema: v3_1.default.discriminatedUnion('type', [
        v3_1.default.object({
            type: v3_1.default.literal('none')
        }),
        v3_1.default.object({
            type: v3_1.default.literal('custom'),
            baseUrl: v3_1.default.string(),
            apiKey: v3_1.default.string(),
            model: v3_1.default.string()
        }),
        v3_1.default.object({
            type: v3_1.default.literal('cloudbase'),
            provider: v3_1.default.string(),
            model: v3_1.default.string()
        })
    ])
};
exports.AIDER = {
    name: 'aider',
    value: 'aider',
    configSchema: v3_1.default.discriminatedUnion('type', [
        v3_1.default.object({
            type: v3_1.default.literal('custom'),
            baseUrl: v3_1.default.string(),
            apiKey: v3_1.default.string(),
            model: v3_1.default.string()
        }),
        v3_1.default.object({
            type: v3_1.default.literal('cloudbase'),
            provider: v3_1.default.string(),
            model: v3_1.default.string()
        })
    ])
};
exports.CURSOR = {
    name: 'Cursor CLI',
    value: 'cursor',
    configSchema: v3_1.default.object({
        type: v3_1.default.literal('none')
    })
};
exports.CODEBUDDY = {
    name: 'CodeBuddy Code',
    value: 'codebuddy',
    configSchema: v3_1.default.discriminatedUnion('type', [
        v3_1.default.object({
            type: v3_1.default.literal('none')
        }),
        v3_1.default.object({
            type: v3_1.default.literal('custom'),
            apiKey: v3_1.default.string().optional()
        })
    ])
};
exports.NONE = {
    name: '暂不配置',
    value: 'none'
};
exports.AGENTS = [exports.CLAUDE, exports.CODEBUDDY, exports.QWEN, exports.CODEX, exports.AIDER, exports.CURSOR, exports.NONE];
exports.CLOUDBASE_PROVIDERS = [
    {
        name: 'Kimi',
        value: 'kimi-exp',
        models: ['kimi-k2-instruct-local'],
        transformer: undefined
    },
    {
        name: 'DeepSeek',
        value: 'deepseek',
        models: ['deepseek-v3'],
        transformer: 'deepseek'
    },
    {
        name: 'LongCat',
        value: 'longcat',
        models: ['LongCat-Flash-Chat'],
        transformer: undefined
    },
];
function getDefaultConfig(agent) {
    const agentConfig = exports.AGENTS.find((a) => a.value === agent);
    if (!agentConfig) {
        return {};
    }
    if ('defaultConfig' in agentConfig) {
        return agentConfig.defaultConfig;
    }
    else {
        return {};
    }
}
exports.getDefaultConfig = getDefaultConfig;
function getAgentConfigValidator(agent) {
    const agentConfig = exports.AGENTS.find((a) => a.value === agent);
    if (!agentConfig)
        throw new Error('Agent not found');
    return 'configSchema' in agentConfig
        ? (x) => agentConfig.configSchema.safeParse(x)
        : () => ({ success: true });
}
exports.getAgentConfigValidator = getAgentConfigValidator;
exports.BASE_URL_MODEL_MAPPING = {
    'https://api.moonshot.cn/v1': 'kimi-k2-0711-preview',
    'https://open.bigmodel.cn/api/paas/v4': 'glm-4.5',
    'https://api.longcat.chat/openai': 'LongCat-Flash-Chat'
};
function getDefaultModelByBaseUrl(baseUrl) {
    return exports.BASE_URL_MODEL_MAPPING[baseUrl] || 'gpt-4';
}
exports.getDefaultModelByBaseUrl = getDefaultModelByBaseUrl;
function getBooleanHint(defaultValue) {
    return `y 是${defaultValue === true ? '(留空默认)' : ''}; n 否${defaultValue === false ? '(留空默认)' : ''}; enter 确认`;
}
exports.getBooleanHint = getBooleanHint;
exports.LIST_HINT = '使用上下键选择，按下 Enter 键确认选项';
