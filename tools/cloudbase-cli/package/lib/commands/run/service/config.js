'use strict'
var __decorate =
    (this && this.__decorate) ||
    function (decorators, target, key, desc) {
        var c = arguments.length,
            r =
                c < 3
                    ? target
                    : desc === null
                      ? (desc = Object.getOwnPropertyDescriptor(target, key))
                      : desc,
            d
        if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function')
            r = Reflect.decorate(decorators, target, key, desc)
        else
            for (var i = decorators.length - 1; i >= 0; i--)
                if ((d = decorators[i]))
                    r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r
        return (c > 3 && r && Object.defineProperty(target, key, r), r)
    }
var __metadata =
    (this && this.__metadata) ||
    function (k, v) {
        if (typeof Reflect === 'object' && typeof Reflect.metadata === 'function')
            return Reflect.metadata(k, v)
    }
var __param =
    (this && this.__param) ||
    function (paramIndex, decorator) {
        return function (target, key) {
            decorator(target, key, paramIndex)
        }
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
Object.defineProperty(exports, '__esModule', { value: true })
exports.ConfigServiceTcbr = void 0
const common_1 = require('../../common')
const decorators_1 = require('../../../decorators')
const run_1 = require('../../../run')
const utils_1 = require('../../../utils')
let ConfigServiceTcbr = class ConfigServiceTcbr extends common_1.Command {
    get options() {
        return {
            cmd: 'run',
            childCmd: 'service:config',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id，必填'
                },
                {
                    flags: '-s, --serviceName <serviceName>',
                    desc: '服务名，必填'
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
                    flags: '--json',
                    desc: '以 JSON 形式展示结果'
                }
            ],
            desc: '指定环境和服务，更新服务的基础配置'
        }
    }
    execute(options, log) {
        return __awaiter(this, void 0, void 0, function* () {
            let envCheckType = yield (0, utils_1.checkTcbrEnv)(options.envId, true)
            if (envCheckType !== 0) {
                ;(0, utils_1.logEnvCheck)(options.envId, envCheckType)
                return
            }
            const newServiceConfig = yield (0, run_1.tcbrServiceConfigOptions)(options)
            const configRes = yield (0, run_1.updateCloudRunServerConfig)({
                envId: options.envId,
                serviceName: options.serviceName,
                ServerBaseConfig: newServiceConfig
            })
            if (options.json) {
                console.log(JSON.stringify(configRes, null, 2))
            } else {
                log.success('更新配置信息成功')
            }
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.ArgsOptions)()),
        __param(1, (0, decorators_1.Log)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object, decorators_1.Logger]),
        __metadata('design:returntype', Promise)
    ],
    ConfigServiceTcbr.prototype,
    'execute',
    null
)
ConfigServiceTcbr = __decorate([(0, common_1.ICommand)()], ConfigServiceTcbr)
exports.ConfigServiceTcbr = ConfigServiceTcbr
