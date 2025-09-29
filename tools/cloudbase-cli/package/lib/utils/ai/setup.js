"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AISetupWizard = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const inquirer_1 = __importDefault(require("inquirer"));
const error_1 = require("../../error");
const utils_1 = require("../../commands/utils");
const constants_1 = require("../../commands/constants");
const const_1 = require("./const");
const config_1 = require("./config");
const auth_1 = require("../../auth");
const output_1 = require("../output");
class AISetupWizard {
    constructor(envId) {
        this.aiConfigManager = new config_1.AIConfigManager();
        this.envId = envId;
    }
    setUpDefault(log, agent) {
        return __awaiter(this, void 0, void 0, function* () {
            log.info('🤖 欢迎使用 CloudBase AI ToolKit CLI 配置向导');
            try {
                this.showConfigInfo(log);
                const defaultAgent = agent || (yield this.selectAgent('选择默认使用的 AI CLI 工具:', false));
                yield this.aiConfigManager.updateDefaultAgent(defaultAgent);
                const currentAgent = defaultAgent;
                yield this.configureAgent(currentAgent, log);
                yield this.ensureGitignore();
                log.info('✅ AI 配置完成！配置信息已保存到 .env.local 文件');
                log.info('💡 提示：请确保 .env.local 文件已添加到 .gitignore 以保护敏感信息');
                log.info('🚀 现在可以使用 tcb ai 命令了！');
                return { defaultAgent };
            }
            catch (error) {
                throw new error_1.CloudBaseError('配置向导执行失败', { original: error });
            }
        });
    }
    setUp(log) {
        return __awaiter(this, void 0, void 0, function* () {
            log.info('🤖 欢迎使用 CloudBase AI ToolKit CLI 配置向导');
            try {
                this.showConfigInfo(log);
                const currentAgent = yield this.selectCurrentAgent();
                if (currentAgent !== const_1.NONE.value) {
                    yield this.configureAgent(currentAgent, log);
                }
                const defaultAgent = yield this.selectDefaultAgent(log);
                yield this.aiConfigManager.updateDefaultAgent(defaultAgent);
                yield this.ensureGitignore();
                log.info('✅ AI 配置完成！配置信息已保存到 .env.local 文件');
                log.info('💡 提示：请确保 .env.local 文件已添加到 .gitignore 以保护敏感信息');
                log.info('🚀 现在可以使用 tcb ai 命令了！');
                return { defaultAgent };
            }
            catch (error) {
                throw new error_1.CloudBaseError('配置向导执行失败', { original: error });
            }
        });
    }
    configureEnvId(log, _envId) {
        return __awaiter(this, void 0, void 0, function* () {
            let envId;
            if (_envId) {
                log.info(`使用传入的 envId ${_envId}`);
                envId = _envId;
            }
            else {
                log.info('未传入 envId，从 cloudbaserc.json 中获取');
                const parser = (0, config_1.createConfigParser)();
                const configEnvId = yield parser.get('envId').catch(() => null);
                if (!configEnvId || configEnvId === '{{env.ENV_ID}}') {
                    log.info('cloudbaserc.json 中无 envId 配置！');
                    const { authSupevisor } = yield Promise.resolve().then(() => __importStar(require('../../utils/auth')));
                    let loginState = yield authSupevisor.getLoginState();
                    if (!loginState) {
                        yield (0, auth_1.checkLogin)();
                        loginState = yield authSupevisor.getLoginState();
                    }
                    envId = yield (0, utils_1.selectEnv)({ source: [constants_1.EnvSource.MINIAPP, constants_1.EnvSource.QCLOUD] });
                    log.info(`已选择 envId: ${envId}`);
                    if (!configEnvId) {
                        parser.update('envId', '{{env.ENV_ID}}');
                    }
                    yield this.aiConfigManager.updateEnvId(envId);
                }
                else {
                    envId = configEnvId;
                    log.info(`使用 cloudbaserc.json 中的 envId: ${configEnvId}`);
                    const { shouldUpdateEnvId } = yield inquirer_1.default.prompt([
                        {
                            type: 'confirm',
                            name: 'shouldUpdateEnvId',
                            message: `当前使用的 envId 为 ${configEnvId}，是否需要更新？ ${(0, const_1.getBooleanHint)(false)}`,
                            default: false
                        }
                    ]);
                    if (shouldUpdateEnvId) {
                        yield (0, auth_1.checkLogin)();
                        envId = yield (0, utils_1.selectEnv)({ source: [constants_1.EnvSource.MINIAPP, constants_1.EnvSource.QCLOUD] });
                        log.info(`已选择 envId: ${envId}`);
                        yield this.aiConfigManager.updateEnvId(envId);
                    }
                }
            }
            return envId;
        });
    }
    selectDefaultAgent(log) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = yield this.aiConfigManager.loadConfig().catch(() => null);
            const configuredAgents = (config === null || config === void 0 ? void 0 : config.agents) ? Object.keys(config.agents) : [];
            if (configuredAgents.length === 0) {
                const errorMsg = '没有已配置的 AI 工具，请先运行 tcb ai --setup 进行配置';
                log.error(errorMsg);
                process.exit(1);
            }
            if (configuredAgents.length === 1) {
                const selectedAgent = configuredAgents[0];
                const agentInfo = [const_1.CLAUDE, const_1.QWEN, const_1.CODEX, const_1.CURSOR, const_1.AIDER].find((a) => a.value === selectedAgent);
                const agentName = (agentInfo === null || agentInfo === void 0 ? void 0 : agentInfo.name) || selectedAgent.toUpperCase();
                log.info(`🔧 自动选择已配置的唯一 AI 工具: ${agentName}`);
                return selectedAgent;
            }
            const availableChoices = configuredAgents.map((agent) => {
                const agentInfo = [const_1.CLAUDE, const_1.QWEN, const_1.CODEX, const_1.CURSOR, const_1.AIDER].find((a) => a.value === agent);
                return agentInfo || { name: agent.toUpperCase(), value: agent };
            });
            const { agent } = yield inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'agent',
                    message: `选择默认使用的 AI CLI 工具: ${const_1.LIST_HINT}`,
                    choices: availableChoices,
                    default: configuredAgents[0]
                }
            ]);
            return agent;
        });
    }
    selectCurrentAgent() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectAgent('选择当前要配置的 AI CLI 工具:', true);
        });
    }
    showConfigInfo(log) {
        log.info('');
        log.info('📋 配置说明：');
        log.info('• 本配置仅在 CloudBase AI CLI 中生效');
        log.info('• 不会修改您系统中已安装的 AI 工具的原始配置');
        log.info('• 配置文件将保存在当前项目目录下（.env.local 等）');
        log.info('• 您可以随时通过 tcb ai --reset 重置配置');
        log.info('');
    }
    selectAgent(message, includeNone = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const { agent } = yield inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'agent',
                    message: `${message} ${const_1.LIST_HINT}`,
                    choices: [const_1.CODEBUDDY, const_1.CLAUDE, const_1.QWEN, const_1.CODEX, const_1.CURSOR, const_1.AIDER, ...(includeNone ? [const_1.NONE] : [])],
                    default: const_1.CODEBUDDY.value
                }
            ]);
            return agent;
        });
    }
    configureAgent(agent, log) {
        return __awaiter(this, void 0, void 0, function* () {
            const agentInfo = [const_1.CLAUDE, const_1.QWEN, const_1.CODEX, const_1.AIDER, const_1.CURSOR, const_1.CODEBUDDY].find((a) => a.value === agent);
            log.info(`\n📝 配置 ${(agentInfo === null || agentInfo === void 0 ? void 0 : agentInfo.name) || agent.toUpperCase()}:`);
            switch (agent) {
                case const_1.CLAUDE.value:
                    return yield this.configureClaudeAgent(log);
                case const_1.QWEN.value:
                    return yield this.configureQwenAgent(log);
                case const_1.CODEX.value:
                    return yield this.configureCodexAgent(log);
                case const_1.AIDER.value:
                    return yield this.configureAiderAgent(log);
                case const_1.CURSOR.value:
                    return yield this.configureCursorAgent(log);
                case const_1.CODEBUDDY.value:
                    return yield this.configureCodebuddyAgent(log);
                default:
                    throw new Error(`不支持的 AI 工具: ${agent}`);
            }
        });
    }
    configureClaudeAgent(log) {
        return __awaiter(this, void 0, void 0, function* () {
            log.info(`配置说明可参考 ${(0, output_1.genClickableLink)('https://docs.cloudbase.net/cli-v1/ai/claude')}`);
            const { configMethod } = yield inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'configMethod',
                    message: `选择配置方式: ${const_1.LIST_HINT}`,
                    choices: [
                        { name: '使用 CloudBase 服务，一键登录，无需配置', value: 'cloudbase' },
                        {
                            name: '自配置 API KEY 和 Base URL，需要支持 Anthropic 协议的大模型',
                            value: 'custom'
                        },
                        { name: '暂不配置，使用 Claude Code 内置鉴权方式（如 OAuth）', value: 'none' }
                    ],
                    default: 'cloudbase'
                }
            ]);
            if (configMethod === 'cloudbase') {
                yield this.configureEnvId(log, this.envId);
                const { provider, model, transformer } = yield this.selectCloudBaseProvider();
                yield this.aiConfigManager.updateClaudeConfig('cloudbase', Object.assign({ provider,
                    model }, (transformer && { transformer })));
            }
            else if (configMethod === 'custom') {
                const { baseUrlChoice } = yield inquirer_1.default.prompt([
                    {
                        type: 'list',
                        name: 'baseUrlChoice',
                        message: `选择 API Base URL: ${const_1.LIST_HINT}`,
                        choices: [
                            {
                                name: 'Kimi - https://api.moonshot.cn/anthropic',
                                value: 'https://api.moonshot.cn/anthropic'
                            },
                            {
                                name: '智谱 - https://open.bigmodel.cn/api/anthropic',
                                value: 'https://open.bigmodel.cn/api/anthropic'
                            },
                            {
                                name: 'Anthropic - https://api.anthropic.com',
                                value: 'https://api.anthropic.com'
                            },
                            {
                                name: 'DeepSeek - https://api.deepseek.com/anthropic',
                                value: 'https://api.deepseek.com/anthropic'
                            },
                            {
                                name: 'LongCat - https://api.longcat.chat/anthropic',
                                value: 'https://api.longcat.chat/anthropic'
                            },
                            { name: '🛠️ 自定义 URL', value: 'custom' }
                        ],
                        default: 'https://api.moonshot.cn/anthropic'
                    }
                ]);
                let baseUrl;
                if (baseUrlChoice === 'custom') {
                    const { customUrl } = yield inquirer_1.default.prompt([
                        {
                            type: 'input',
                            name: 'customUrl',
                            message: '请输入自定义 API Base URL:',
                            validate: (input) => input.trim().length > 0 || '请输入有效的 Base URL'
                        }
                    ]);
                    baseUrl = customUrl;
                }
                else {
                    baseUrl = baseUrlChoice;
                }
                const { apiKey } = yield inquirer_1.default.prompt([
                    {
                        type: 'password',
                        name: 'apiKey',
                        message: 'Auth Token:',
                        validate: (input) => input.length > 0 || '请输入有效的 Auth Token'
                    }
                ]);
                let defaultModel;
                if (baseUrl === 'https://api.anthropic.com') {
                    defaultModel = 'sonnet';
                }
                else if (baseUrl === 'https://api.moonshot.cn/anthropic') {
                    defaultModel = 'kimi-k2-turbo-preview';
                }
                else if (baseUrl === 'https://open.bigmodel.cn/api/anthropic') {
                    defaultModel = 'glm-4.5';
                }
                else if (baseUrl === 'https://api.deepseek.com/anthropic') {
                    defaultModel = 'deepseek-chat';
                }
                else if (baseUrl === 'https://api.longcat.chat/anthropic') {
                    defaultModel = 'LongCat-Flash-Chat';
                }
                else {
                    defaultModel = '';
                }
                const { model } = yield inquirer_1.default.prompt([
                    {
                        type: 'input',
                        name: 'model',
                        message: '模型名称:',
                        default: defaultModel,
                        validate: (input) => input.trim().length > 0 || '请输入有效的模型名称'
                    }
                ]);
                yield this.aiConfigManager.updateClaudeConfig('custom', {
                    baseUrl,
                    apiKey,
                    model
                });
            }
            else {
                yield this.aiConfigManager.updateClaudeConfig('none', {});
            }
        });
    }
    configureQwenAgent(log) {
        return __awaiter(this, void 0, void 0, function* () {
            log.info(`配置说明可参考 ${(0, output_1.genClickableLink)('https://docs.cloudbase.net/cli-v1/ai/qwen')}`);
            const { configMethod } = yield inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'configMethod',
                    message: `选择配置方式: ${const_1.LIST_HINT}`,
                    choices: [
                        { name: '使用 CloudBase 服务，一键登录，无需配置', value: 'cloudbase' },
                        { name: '自配置 API KEY 和 Base URL', value: 'custom' },
                        { name: '暂不配置，使用 Qwen Code 内置鉴权方式（如 OAuth）', value: 'none' }
                    ],
                    default: 'cloudbase'
                }
            ]);
            if (configMethod === 'cloudbase') {
                yield this.configureEnvId(log, this.envId);
                const { provider, model } = yield this.selectCloudBaseProvider();
                yield this.aiConfigManager.updateQwenConfig('cloudbase', {
                    provider,
                    model
                });
            }
            else if (configMethod === 'custom') {
                const { apiKey, baseUrl, model } = yield inquirer_1.default.prompt([
                    {
                        type: 'input',
                        name: 'baseUrl',
                        message: 'API Base URL (留空使用默认):',
                        default: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
                    },
                    {
                        type: 'password',
                        name: 'apiKey',
                        message: 'API Key:',
                        validate: (input) => input.length > 0 || '请输入有效的 API Key'
                    },
                    {
                        type: 'input',
                        name: 'model',
                        message: '模型名称 (留空使用默认):',
                        default: 'qwen-turbo'
                    }
                ]);
                yield this.aiConfigManager.updateQwenConfig('custom', { baseUrl, apiKey, model });
            }
            else {
                yield this.aiConfigManager.updateQwenConfig('none', {});
            }
        });
    }
    configureCodexAgent(log) {
        return __awaiter(this, void 0, void 0, function* () {
            log.info(`配置说明可参考 ${(0, output_1.genClickableLink)('https://docs.cloudbase.net/cli-v1/ai/codex')}`);
            const { configMethod } = yield inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'configMethod',
                    message: `选择配置方式: ${const_1.LIST_HINT}`,
                    choices: [
                        { name: '使用 CloudBase 服务，一键登录，无需配置', value: 'cloudbase' },
                        { name: '自配置 API KEY 和 Base URL', value: 'custom' },
                        { name: '暂不配置，使用 OpenAI Codex 内置鉴权方式（如 OAuth）', value: 'none' }
                    ],
                    default: 'cloudbase'
                }
            ]);
            if (configMethod === 'cloudbase') {
                yield this.configureEnvId(log, this.envId);
                const { provider, model } = yield this.selectCloudBaseProvider();
                yield this.aiConfigManager.updateCodexConfig('cloudbase', {
                    provider,
                    model
                });
            }
            else if (configMethod === 'custom') {
                const { baseUrlChoice } = yield inquirer_1.default.prompt([
                    {
                        type: 'list',
                        name: 'baseUrlChoice',
                        message: `选择 API Base URL: ${const_1.LIST_HINT}`,
                        choices: [
                            {
                                name: 'Kimi - https://api.moonshot.cn/v1',
                                value: 'https://api.moonshot.cn/v1'
                            },
                            {
                                name: '智谱 - https://open.bigmodel.cn/api/paas/v4',
                                value: 'https://open.bigmodel.cn/api/paas/v4'
                            },
                            {
                                name: 'LongCat - https://api.longcat.chat/openai',
                                value: 'https://api.longcat.chat/openai'
                            },
                            { name: '🛠️ 自定义 URL', value: 'custom' }
                        ],
                        default: 'https://api.moonshot.cn/v1'
                    }
                ]);
                let baseUrl;
                if (baseUrlChoice === 'custom') {
                    const { customUrl } = yield inquirer_1.default.prompt([
                        {
                            type: 'input',
                            name: 'customUrl',
                            message: '请输入自定义 API Base URL:',
                            validate: (input) => input.trim().length > 0 || '请输入有效的 Base URL'
                        }
                    ]);
                    baseUrl = customUrl;
                }
                else {
                    baseUrl = baseUrlChoice;
                }
                const { apiKey, model } = yield inquirer_1.default.prompt([
                    {
                        type: 'password',
                        name: 'apiKey',
                        message: 'API Key:',
                        validate: (input) => input.length > 0 || '请输入有效的 API Key'
                    },
                    {
                        type: 'input',
                        name: 'model',
                        message: '模型名称 (留空使用默认):',
                        default: (0, const_1.getDefaultModelByBaseUrl)(baseUrl)
                    }
                ]);
                yield this.aiConfigManager.updateCodexConfig('custom', { baseUrl, apiKey, model });
            }
            else {
                yield this.aiConfigManager.updateCodexConfig('none', {});
            }
        });
    }
    configureAiderAgent(log) {
        return __awaiter(this, void 0, void 0, function* () {
            log.info(`配置说明可参考 ${(0, output_1.genClickableLink)('https://docs.cloudbase.net/cli-v1/ai/aider')}`);
            const { configMethod } = yield inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'configMethod',
                    message: `选择配置方式: ${const_1.LIST_HINT}`,
                    choices: [
                        { name: '使用 CloudBase 服务，一键登录，无需配置', value: 'cloudbase' },
                        { name: '自配置 API KEY 和 Base URL', value: 'custom' }
                    ],
                    default: 'cloudbase'
                }
            ]);
            if (configMethod === 'cloudbase') {
                yield this.configureEnvId(log, this.envId);
                const { provider, model } = yield this.selectCloudBaseProvider();
                yield this.aiConfigManager.updateAiderConfig('cloudbase', {
                    provider,
                    model
                });
            }
            else {
                const { baseUrlChoice } = yield inquirer_1.default.prompt([
                    {
                        type: 'list',
                        name: 'baseUrlChoice',
                        message: `选择 API Base URL: ${const_1.LIST_HINT}`,
                        choices: [
                            {
                                name: 'Kimi - https://api.moonshot.cn/v1',
                                value: 'https://api.moonshot.cn/v1'
                            },
                            {
                                name: '智谱 - https://open.bigmodel.cn/api/paas/v4',
                                value: 'https://open.bigmodel.cn/api/paas/v4'
                            },
                            {
                                name: 'LongCat - https://api.longcat.chat/openai',
                                value: 'https://api.longcat.chat/openai'
                            },
                            { name: '🛠️ 自定义 URL', value: 'custom' }
                        ],
                        default: 'https://api.moonshot.cn/v1'
                    }
                ]);
                let baseUrl;
                if (baseUrlChoice === 'custom') {
                    const { customUrl } = yield inquirer_1.default.prompt([
                        {
                            type: 'input',
                            name: 'customUrl',
                            message: '请输入自定义 API Base URL:',
                            validate: (input) => input.trim().length > 0 || '请输入有效的 Base URL'
                        }
                    ]);
                    baseUrl = customUrl;
                }
                else {
                    baseUrl = baseUrlChoice;
                }
                const { apiKey, model } = yield inquirer_1.default.prompt([
                    {
                        type: 'password',
                        name: 'apiKey',
                        message: 'API Key:',
                        validate: (input) => input.length > 0 || '请输入有效的 API Key'
                    },
                    {
                        type: 'input',
                        name: 'model',
                        message: '模型名称:',
                        default: (0, const_1.getDefaultModelByBaseUrl)(baseUrl),
                        validate: (input) => input.length > 0 || '请输入有效的模型名称'
                    }
                ]);
                yield this.aiConfigManager.updateAiderConfig('custom', { baseUrl, apiKey, model });
            }
        });
    }
    configureCursorAgent(log) {
        return __awaiter(this, void 0, void 0, function* () {
            log.info(`配置说明可参考 ${(0, output_1.genClickableLink)('https://docs.cloudbase.net/cli-v1/ai/cursor')}`);
            yield this.aiConfigManager.updateCursorConfig('none');
        });
    }
    ensureGitignore() {
        return __awaiter(this, void 0, void 0, function* () {
            const gitignorePath = path_1.default.join(process.cwd(), '.gitignore');
            try {
                let gitignoreContent = '';
                if (yield fs_extra_1.default.pathExists(gitignorePath)) {
                    gitignoreContent = yield fs_extra_1.default.readFile(gitignorePath, 'utf8');
                }
                const patterns = ['.env.local', '.env'];
                let needsUpdate = false;
                for (const pattern of patterns) {
                    if (!gitignoreContent.includes(pattern)) {
                        if (!needsUpdate) {
                            gitignoreContent += '\n# Environment variables\n';
                            needsUpdate = true;
                        }
                        gitignoreContent += `${pattern}\n`;
                    }
                }
                if (needsUpdate) {
                    yield fs_extra_1.default.writeFile(gitignorePath, gitignoreContent);
                }
            }
            catch (error) {
            }
        });
    }
    selectCloudBaseProvider() {
        return __awaiter(this, void 0, void 0, function* () {
            const { selectedProvider } = yield inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'selectedProvider',
                    message: `选择大模型供应商: ${const_1.LIST_HINT}`,
                    choices: const_1.CLOUDBASE_PROVIDERS.map((p) => ({ name: p.name, value: p.value })),
                    default: 'kimi-exp'
                }
            ]);
            if (selectedProvider === 'custom') {
                const { provider, model } = yield inquirer_1.default.prompt([
                    {
                        type: 'input',
                        name: 'provider',
                        message: '请输入自定义供应商名称:',
                        validate: (input) => input.trim().length > 0 || '供应商名称不能为空'
                    },
                    {
                        type: 'input',
                        name: 'model',
                        message: '请输入模型名称:',
                        validate: (input) => input.trim().length > 0 || '模型名称不能为空'
                    }
                ]);
                return { provider, model, isCustom: true, transformer: undefined };
            }
            else {
                const selectedConfig = const_1.CLOUDBASE_PROVIDERS.find((p) => p.value === selectedProvider);
                const modelChoices = [
                    ...selectedConfig.models.map((m) => ({ name: m, value: m }))
                ];
                const { selectedModel } = yield inquirer_1.default.prompt([
                    {
                        type: 'list',
                        name: 'selectedModel',
                        message: `选择模型: ${const_1.LIST_HINT}`,
                        choices: modelChoices,
                        default: selectedConfig.models[0]
                    }
                ]);
                let model;
                if (selectedModel === 'custom') {
                    const { customModel } = yield inquirer_1.default.prompt([
                        {
                            type: 'input',
                            name: 'customModel',
                            message: '请输入自定义模型名称:',
                            validate: (input) => input.trim().length > 0 || '模型名称不能为空'
                        }
                    ]);
                    model = customModel;
                }
                else {
                    model = selectedModel;
                }
                return {
                    provider: selectedProvider,
                    model,
                    isCustom: false,
                    transformer: selectedConfig.transformer
                };
            }
        });
    }
    configureCodebuddyAgent(log) {
        return __awaiter(this, void 0, void 0, function* () {
            log.info(`配置说明可参考 ${(0, output_1.genClickableLink)('https://cnb.woa.com/genie/genie/-/tree/main/docs')}`);
            const { configMethod } = yield inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'configMethod',
                    message: `选择配置方式: ${const_1.LIST_HINT}`,
                    choices: [
                        {
                            name: '使用 CodeBuddy 账号登录',
                            value: 'none'
                        },
                        {
                            name: '配置 CodeBuddy API KEY（用于无交互环境）',
                            value: 'custom'
                        }
                    ],
                    default: 'none'
                }
            ]);
            if (configMethod === 'custom') {
                const { apiKey } = yield inquirer_1.default.prompt([
                    {
                        type: 'password',
                        name: 'apiKey',
                        message: 'API Key:',
                        validate: (input) => input.trim().length > 0 || '请输入有效的 API Key'
                    }
                ]);
                yield this.aiConfigManager.updateCodebuddyConfig('custom', {
                    apiKey
                });
            }
            else {
                yield this.aiConfigManager.updateCodebuddyConfig('none', {});
            }
            log.info('✅ CodeBuddy Code 配置完成');
            log.info('💡 提示：首次使用时会自动打开浏览器进行 OAuth 身份验证');
        });
    }
}
exports.AISetupWizard = AISetupWizard;
