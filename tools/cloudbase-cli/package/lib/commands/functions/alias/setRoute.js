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
exports.setFunctionRoutingConfig = void 0
const common_1 = require('../../common')
const error_1 = require('../../../error')
const utils_1 = require('../../../utils')
const function_1 = require('../../../function')
const decorators_1 = require('../../../decorators')
let setFunctionRoutingConfig = class setFunctionRoutingConfig extends common_1.Command {
    get options() {
        return {
            cmd: 'fn',
            childCmd: 'config-route <name> <version1> <traffic1> [version2] [traffic2]',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                }
            ],
            desc: '设置函数版本流量配置'
        }
    }
    execute(ctx, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const name = params === null || params === void 0 ? void 0 : params[0]
            const version1 = params === null || params === void 0 ? void 0 : params[1]
            const traffic1 = Number(params === null || params === void 0 ? void 0 : params[2])
            const version2 = params === null || params === void 0 ? void 0 : params[3]
            const traffic2 = Number(params === null || params === void 0 ? void 0 : params[4])
            if (
                (version2 === undefined && traffic2 !== undefined) ||
                (version2 !== undefined && traffic2 === undefined)
            ) {
                throw new error_1.CloudBaseError('version2 和 traffic2 必须同时设置')
            }
            if (traffic1 !== undefined && traffic2 !== undefined) {
                if (traffic1 + traffic2 !== 100) {
                    throw new error_1.CloudBaseError(
                        'traffic1 和 traffic2 同时设置时，需保证总和 100'
                    )
                }
            }
            const { envId } = ctx
            const loading = (0, utils_1.loadingFactory)()
            loading.start(`设置函数 [${name}] 版本流量配置中...`)
            let routingConfigParams = {
                AddtionVersionMatchs: [
                    {
                        Expression: `[0,${traffic1})`,
                        Key: 'invoke.headers.X-Tcb-Route-Key',
                        Method: 'range',
                        Version: version1
                    }
                ]
            }
            if (version2 !== undefined) {
                routingConfigParams.AddtionVersionMatchs.push({
                    Expression: `[${traffic1},${100})`,
                    Key: 'invoke.headers.X-Tcb-Route-Key',
                    Method: 'range',
                    Version: version2
                })
            }
            yield (0, function_1.setFunctionAliasConfig)({
                envId,
                functionName: name,
                name: '$DEFAULT',
                functionVersion: '$LATEST',
                routingConfig: routingConfigParams
            })
            loading.succeed(`设置函数 [${name}] 版本流量配置成功！`)
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.CmdContext)()),
        __param(1, (0, decorators_1.ArgsParams)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object, Object]),
        __metadata('design:returntype', Promise)
    ],
    setFunctionRoutingConfig.prototype,
    'execute',
    null
)
setFunctionRoutingConfig = __decorate([(0, common_1.ICommand)()], setFunctionRoutingConfig)
exports.setFunctionRoutingConfig = setFunctionRoutingConfig
