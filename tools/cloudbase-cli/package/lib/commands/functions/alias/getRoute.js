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
exports.getFunctionRoutingConfig = void 0
const common_1 = require('../../common')
const utils_1 = require('../../../utils')
const function_1 = require('../../../function')
const decorators_1 = require('../../../decorators')
function parseRoutingConfigValue(expression) {
    const commaIndex = expression.indexOf(',')
    const valueExpression = expression.substring(commaIndex + 1, expression.length - 1)
    return valueExpression
}
let getFunctionRoutingConfig = class getFunctionRoutingConfig extends common_1.Command {
    get options() {
        return {
            cmd: 'fn',
            childCmd: 'get-route <name>',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                }
            ],
            desc: '查看函数版本流量配置'
        }
    }
    execute(ctx, params) {
        var _a
        return __awaiter(this, void 0, void 0, function* () {
            const name = params === null || params === void 0 ? void 0 : params[0]
            const { envId } = ctx
            const loading = (0, utils_1.loadingFactory)()
            loading.start(`查询函数 [${name}] 版本流量配置中...`)
            const aliasRes = yield (0, function_1.getFunctionAliasConfig)({
                envId,
                functionName: name,
                name: '$DEFAULT'
            })
            const routingConfig =
                (_a =
                    aliasRes === null || aliasRes === void 0 ? void 0 : aliasRes.RoutingConfig) ===
                    null || _a === void 0
                    ? void 0
                    : _a.AddtionVersionMatchs
            let finalConfig = []
            if (routingConfig.length === 1) {
                finalConfig.push({
                    version: routingConfig[0].Version,
                    value: parseRoutingConfigValue(routingConfig[0].Expression)
                })
            } else if (routingConfig.length === 2) {
                finalConfig.push(
                    {
                        version: routingConfig[0].Version,
                        value: parseRoutingConfigValue(routingConfig[0].Expression)
                    },
                    {
                        version: routingConfig[1].Version,
                        value: 100 - Number(parseRoutingConfigValue(routingConfig[0].Expression))
                    }
                )
            }
            loading.stop()
            const head = ['版本', '流量比例']
            const tableData = finalConfig.map((item) => [item.version, item.value])
            ;(0, utils_1.printHorizontalTable)(head, tableData)
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
    getFunctionRoutingConfig.prototype,
    'execute',
    null
)
getFunctionRoutingConfig = __decorate([(0, common_1.ICommand)()], getFunctionRoutingConfig)
exports.getFunctionRoutingConfig = getFunctionRoutingConfig
