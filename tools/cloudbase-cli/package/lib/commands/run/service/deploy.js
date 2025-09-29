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
exports.DeployServiceTcbr = void 0;
const common_1 = require("../../common");
const decorators_1 = require("../../../decorators");
const run_1 = require("../../../run");
const utils_1 = require("../../../utils");
const toolbox_1 = require("@cloudbase/toolbox");
let DeployServiceTcbr = class DeployServiceTcbr extends common_1.Command {
    get options() {
        return {
            cmd: 'run',
            childCmd: 'deploy',
            options: [
                {
                    flags: '--noConfirm',
                    desc: '发布前是否跳过二次确认'
                },
                {
                    flags: '--override',
                    desc: '缺省的参数是否沿用旧版本配置'
                },
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id，必填'
                },
                {
                    flags: '-s, --serviceName <serviceName>',
                    desc: '服务名，必填'
                },
                {
                    flags: '--path <path>',
                    desc: '本地代码根目录'
                },
                {
                    flags: '--cpu <cpu>',
                    desc: '单一实例cpu规格，默认0.5'
                },
                {
                    flags: '--mem <mem>',
                    desc: '单一实例内存规格，默认1'
                },
                {
                    flags: '--minNum <minNum>',
                    desc: '最小副本数，默认0'
                },
                {
                    flags: '--maxNum <maxNum>',
                    desc: '最大副本数，默认50，不能大于50'
                },
                {
                    flags: '--policyDetails <policyDetails>',
                    desc: '扩缩容配置，格式为条件类型=条件比例（%），多个条件之间用&隔开，内存条件为mem，cpu条件为cpu，默认内存>60% 或 CPU>60%，即cpu=60&mem=60'
                },
                {
                    flags: '--customLogs <customLogs>',
                    desc: '日志采集路径，默认stdout'
                },
                {
                    flags: '--envParams <envParams>',
                    desc: '环境变量，格式为xx=a&yy=b，默认为空'
                },
                {
                    flags: '--log_type <log_type>',
                    desc: '日志类型，只能为 none，如需自定义日志，请前往控制台配置'
                },
                {
                    flags: '--containerPort <containerPort>',
                    desc: '监听端口，必填'
                },
                {
                    flags: '--remark <remark>',
                    desc: '版本备注，默认为空'
                },
                {
                    flags: '--targetDir <targetDir>',
                    desc: '目标目录'
                },
                {
                    flags: '--dockerfile <dockerfile>',
                    desc: 'Dockerfile文件名，默认为 Dockerfile'
                },
                {
                    flags: '--custom_image <custom_image>',
                    desc: 'TCR 仓库镜像 URL'
                },
                {
                    flags: '--library_image <library_image>',
                    desc: '线上镜像仓库的 tag，仅在服务已存在时可用'
                },
                {
                    flags: '--image <image>',
                    desc: '镜像标签或ID'
                },
                {
                    flags: '--json',
                    desc: '以 JSON 形式展示结果'
                }
            ],
            desc: '在指定的环境部署服务'
        };
    }
    execute(options) {
        return __awaiter(this, void 0, void 0, function* () {
            let envCheckType = yield (0, utils_1.checkTcbrEnv)(options.envId, true);
            if (envCheckType !== 0) {
                (0, utils_1.logEnvCheck)(options.envId, envCheckType);
                return;
            }
            const { data: serviceDetail } = yield (0, run_1.describeCloudRunServerDetail)({
                envId: options.envId,
                serviceName: options.serviceName
            });
            if (serviceDetail === undefined) {
                throw new toolbox_1.CloudBaseError(`当前服务不存在，请前往控制台 ${(0, utils_1.genClickableLink)('https://console.cloud.tencent.com/tcbr')} 创建服务`);
            }
            else {
                yield (0, run_1.updateTcbrService)(options);
            }
        });
    }
};
__decorate([
    (0, decorators_1.InjectParams)(),
    __param(0, (0, decorators_1.ArgsOptions)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DeployServiceTcbr.prototype, "execute", null);
DeployServiceTcbr = __decorate([
    (0, common_1.ICommand)()
], DeployServiceTcbr);
exports.DeployServiceTcbr = DeployServiceTcbr;
