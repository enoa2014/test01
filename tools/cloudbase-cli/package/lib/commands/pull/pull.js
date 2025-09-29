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
exports.PullCommand = void 0;
const common_1 = require("../common");
const decorators_1 = require("../../decorators");
const log_1 = require("../../utils/log");
const template_manager_1 = require("../../utils/template-manager");
const error_1 = require("../../error");
let PullCommand = class PullCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'pull',
            options: [
                {
                    flags: '-s, --source <source>',
                    desc: '指定模板来源'
                },
                {
                    flags: '-o, --output <output>',
                    desc: '指定输出目录'
                },
                {
                    flags: '-f, --force',
                    desc: '强制清理目标输出目录（慎用）'
                }
            ],
            desc: '拉取项目模板\n\n支持的内置模板:\n  miniprogram  - 微信小程序 + CloudBase\n  react        - Web 应用 - React + CloudBase\n  vue          - Web 应用 - Vue + CloudBase\n  uniapp       - 跨端应用 - UniApp + CloudBase\n  rules        - AI 规则和配置\n\n支持的 Git 仓库:\n  GitHub: https://github.com/user/repo\n  Gitee:  https://gitee.com/user/repo\n  CNB:    https://cnb.cool/user/repo\n  SSH:    git@github.com:user/repo.git\n\n支持 Git 子目录:\n  https://github.com/user/repo/tree/main/src/templates\n  https://cnb.cool/user/repo/tree/main/examples\n\n示例:\n  tcb pull miniprogram\n  tcb pull https://github.com/user/repo\n  tcb pull https://cnb.cool/user/repo\n  tcb pull https://cnb.cool/user/repo/tree/main/examples --output ./my-project',
            requiredEnvId: false,
            withoutAuth: true
        };
    }
    execute(options, params, log) {
        return __awaiter(this, void 0, void 0, function* () {
            const { output, force, source } = options;
            if (process.argv[3] === 'list') {
                const templateManager = new template_manager_1.TemplateManager();
                yield this.showTemplateList(templateManager, log);
                return;
            }
            if (!source || typeof source !== 'string') {
                throw new error_1.CloudBaseError('请指定要拉取的模板来源');
            }
            try {
                const templateManager = new template_manager_1.TemplateManager();
                yield templateManager.pullTemplate(source, { output, force }, log);
                log.info('🎉 模板拉取完成！');
                if (output) {
                    log.info(`📁 项目已创建在: ${output}`);
                }
            }
            catch (error) {
                throw new error_1.CloudBaseError(`拉取模板失败: ${error.message}`, { original: error });
            }
        });
    }
    showTemplateList(templateManager, log) {
        return __awaiter(this, void 0, void 0, function* () {
            const templates = templateManager.getBuiltinTemplates();
            log.info('📋 可用的内置模板:');
            for (const [key, name] of Object.entries(templates)) {
                log.info(`  ${key.padEnd(12)} - ${name}`);
            }
            log.info('\n🌐 支持的 Git 仓库格式:');
            log.info('  GitHub: https://github.com/user/repo');
            log.info('  Gitee:  https://gitee.com/user/repo');
            log.info('  CNB:    https://cnb.cool/user/repo');
            log.info('  SSH:    git@github.com:user/repo.git');
            log.info('\n📁 支持 Git 子目录:');
            log.info('  https://github.com/user/repo/tree/main/src/templates');
        });
    }
};
__decorate([
    (0, decorators_1.InjectParams)(),
    __param(0, (0, decorators_1.ArgsOptions)()),
    __param(1, (0, decorators_1.ArgsParams)()),
    __param(2, (0, decorators_1.Log)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Array, log_1.Logger]),
    __metadata("design:returntype", Promise)
], PullCommand.prototype, "execute", null);
PullCommand = __decorate([
    (0, common_1.ICommand)()
], PullCommand);
exports.PullCommand = PullCommand;
