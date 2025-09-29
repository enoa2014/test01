"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AICommand = void 0;
const common_1 = require("../common");
const decorators_1 = require("../../decorators");
const log_1 = require("../../utils/log");
const config_1 = require("../../utils/ai/config");
const router_1 = require("../../utils/ai/router");
const setup_1 = require("../../utils/ai/setup");
const report_1 = require("../../utils/report");
const error_1 = require("../../error");
const banner_1 = require("../../utils/ai/banner");
const ensureFiles_1 = require("../../utils/ai/ensureFiles");
let AICommand = class AICommand extends common_1.Command {
    get options() {
        return {
            cmd: 'ai',
            options: [
                {
                    flags: '-a, --agent <agent>',
                    desc: 'AI CLI 工具 (claude, qwen, codex, aider, codebuddy)'
                },
                {
                    flags: '-e, --envId <envId>',
                    desc: '云开发环境 ID'
                },
                {
                    flags: '--template <template>',
                    desc: '指定模板类型 (miniprogram, react, vue, uniapp, rules)'
                },
                {
                    flags: '--setup',
                    desc: '运行配置向导'
                },
                {
                    flags: '--config',
                    desc: '显示配置信息'
                },
                {
                    flags: '--reset',
                    desc: '重置配置'
                },
                {
                    flags: '--template <template>',
                    desc: '指定模板类型 (miniprogram, react, vue, uniapp, rules)'
                }
            ],
            desc: 'CloudBase AI ToolKit CLI - 快速启动和配置主流 AI 编程工具\n\n示例：\n  tcb ai -a claude -- --continue\n  tcb ai -a codebuddy -- mcp list\n\n说明：-- 后的参数会直接传递给目标 AI CLI。',
            requiredEnvId: false,
            withoutAuth: true,
            allowUnknownOption: true
        };
    }
    execute(options, ctx, log) {
        return __awaiter(this, void 0, void 0, function* () {
            yield (0, ensureFiles_1.ensureFiles)();
            const { envId, setup, config, reset, template } = options;
            let { agent } = options;
            try {
                yield (0, banner_1.showBanner)(log);
                yield reportAIUsage(agent, Boolean(envId), this.getSubCommand(ctx.params));
                const configManager = new config_1.AIConfigManager();
                if (reset) {
                    return yield this.resetConfig(configManager, log);
                }
                if (setup) {
                    const wizard = new setup_1.AISetupWizard(envId);
                    return yield wizard.setUp(log);
                }
                if (config) {
                    return yield this.showConfig(configManager, log);
                }
                if (!(yield configManager.isConfigured())) {
                    const wizard = new setup_1.AISetupWizard(envId);
                    const { defaultAgent } = yield wizard.setUpDefault(log, agent);
                    agent = defaultAgent;
                }
                const args = this.parseArgs();
                const router = new router_1.AICommandRouter();
                yield router.execute({
                    addtionalArgs: args,
                    log,
                    agent: agent || (yield configManager.loadConfig()).defaultAgent,
                    envId,
                    template
                });
            }
            catch (error) {
                yield reportAIError(agent, error.message);
                throw error;
            }
        });
    }
    resetConfig(configManager, log) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield configManager.resetConfig();
                log.info('✅ AI 配置已重置');
            }
            catch (error) {
                throw new error_1.CloudBaseError('重置配置失败', { original: error });
            }
        });
    }
    showConfig(configManager, log) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const aiConfig = yield configManager.loadConfig();
                log.info('当前 AI 配置:');
                log.info(JSON.stringify(aiConfig, null, 2));
            }
            catch (error) {
                if (error instanceof error_1.CloudBaseError && error.code === config_1.CONFIG_NOT_FOUND) {
                    log.error(error.message);
                }
                else {
                    throw new error_1.CloudBaseError('读取配置失败', { original: error });
                }
            }
        });
    }
    parseArgs() {
        const args = process.argv.slice(2);
        const doubleDashIndex = args.indexOf('--');
        if (doubleDashIndex !== -1) {
            return args.slice(doubleDashIndex + 1);
        }
        return [];
    }
    getSubCommand(params) {
        return params.length > 0 ? params[0] : 'default';
    }
};
__decorate([
    (0, decorators_1.InjectParams)(),
    __param(0, (0, decorators_1.ArgsOptions)()),
    __param(1, (0, decorators_1.CmdContext)()),
    __param(2, (0, decorators_1.Log)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, log_1.Logger]),
    __metadata("design:returntype", Promise)
], AICommand.prototype, "execute", null);
AICommand = __decorate([
    (0, common_1.ICommand)()
], AICommand);
exports.AICommand = AICommand;
function reportAIUsage(agent, hasEnvId, subCommand) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield report_1.beaconAction.report('ai_command_usage', {
                agent,
                hasEnvId,
                subCommand
            });
        }
        catch (error) {
            return null;
        }
    });
}
function reportAIError(agent, error) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield report_1.beaconAction.report('ai_command_error', {
                agent,
                error
            });
        }
        catch (error) {
            return null;
        }
    });
}
