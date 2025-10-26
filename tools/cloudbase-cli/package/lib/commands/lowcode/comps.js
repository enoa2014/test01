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
exports.LowCodePublishVersionComps =
    exports.LowCodePublishComps =
    exports.LowCodeDebugComps =
    exports.LowCodeBuildComps =
    exports.LowCodeCreateComps =
        void 0
const common_1 = require('../common')
const decorators_1 = require('../../decorators')
const enquirer_1 = require('enquirer')
const semver = __importStar(require('semver'))
const utils_1 = require('../../utils')
const cloud_api_1 = require('@cloudbase/cloud-api')
const error_1 = require('../../error')
const utils_2 = require('./utils')
let lowcodeCli
if (process.argv.includes('lowcode')) {
    ;(0, utils_2.getLowcodeCli)().then((_) => (lowcodeCli = _))
}
let LowCodeCreateComps = class LowCodeCreateComps extends common_1.Command {
    get options() {
        return {
            cmd: 'lowcode',
            childCmd: 'create [name]',
            options: [
                {
                    flags: '--verbose',
                    desc: '是否打印详细日志'
                },
                {
                    flags: '--skip-validate',
                    desc: '是否跳过组件存在性检查'
                }
            ],
            desc: '创建组件库',
            requiredEnvId: false
        }
    }
    execute(opts, params, isPrivateEnv, config, log) {
        return __awaiter(this, void 0, void 0, function* () {
            const mergesOptions = (0, utils_2.getMergedOptions)(
                (0, utils_2.getCmdConfig)(config, this.options),
                opts
            )
            if (mergesOptions.skipValidate) {
                if (!(params === null || params === void 0 ? void 0 : params[0])) {
                    throw new error_1.CloudBaseError(
                        'skip validate 需要指定组件库名 eg: `tcb lowcode create mydemo`'
                    )
                }
                yield lowcodeCli.bootstrap(
                    params === null || params === void 0 ? void 0 : params[0],
                    log
                )
                return
            }
            const privateSettings = (0, utils_1.getPrivateSettings)(config, this.options.cmd)
            if (process.env.CLOUDBASE_LOWCODE_CLOUDAPI_URL === undefined) {
                process.env.CLOUDBASE_LOWCODE_CLOUDAPI_URL =
                    'https://lcap.cloud.tencent.com/api/v1/cliapi'
            }
            let cloudService
            if (isPrivateEnv) {
                cloudService = cloud_api_1.CloudApiService.getInstance({
                    service: 'lowcode',
                    credential: privateSettings.credential
                })
            } else {
                cloudService = utils_1.CloudApiService.getInstance('lowcode')
            }
            const res = yield cloudService.request(
                'ListUserCompositeGroups',
                isPrivateEnv
                    ? {
                          privateUin: privateSettings.privateUin
                      }
                    : undefined
            )
            const comps = res === null || res === void 0 ? void 0 : res.data
            if (!(comps === null || comps === void 0 ? void 0 : comps.count)) {
                throw new error_1.CloudBaseError(
                    '没有可关联的云端组件库，请到低码控制台新建组件库！'
                )
            }
            let compsName = params === null || params === void 0 ? void 0 : params[0]
            if (!compsName) {
                const { selectCompsName } = yield (0, enquirer_1.prompt)({
                    type: 'select',
                    name: 'selectCompsName',
                    message: '关联云端组件库:',
                    choices: comps.rows.map((row) => row.groupName)
                })
                compsName = selectCompsName
            } else {
                const comp = comps.rows.find((row) => row.groupName === compsName)
                if (!comp) {
                    throw new error_1.CloudBaseError(
                        `云端不存在组件库 ${compsName}，请在微搭控制台-应用菜单中，打开任意一个应用的编辑器，点击素材-组件库管理模块，并创建组件库`
                    )
                }
            }
            yield lowcodeCli.bootstrap(compsName, log)
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.ArgsOptions)()),
        __param(1, (0, decorators_1.ArgsParams)()),
        __param(2, (0, decorators_1.IsPrivateEnv)()),
        __param(3, (0, decorators_1.Config)()),
        __param(4, (0, decorators_1.Log)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object, Object, Boolean, Object, decorators_1.Logger]),
        __metadata('design:returntype', Promise)
    ],
    LowCodeCreateComps.prototype,
    'execute',
    null
)
LowCodeCreateComps = __decorate(
    [
        (0, common_1.ICommand)({
            supportPrivate: true
        })
    ],
    LowCodeCreateComps
)
exports.LowCodeCreateComps = LowCodeCreateComps
let LowCodeBuildComps = class LowCodeBuildComps extends common_1.Command {
    get options() {
        return {
            cmd: 'lowcode',
            childCmd: 'build',
            options: [
                {
                    flags: '--verbose',
                    desc: '是否打印详细日志'
                }
            ],
            desc: '构建组件库',
            requiredEnvId: false
        }
    }
    execute(ctx, log) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = ctx.config.lowcodeCustomComponents
            if (config) {
                yield lowcodeCli.graceBuildComps(
                    Object.assign(Object.assign({}, config), {
                        context: config.context || process.cwd(),
                        logger: log,
                        privateSettings: (0, utils_1.getPrivateSettings)(
                            ctx.config,
                            this.options.cmd
                        ),
                        envId: ctx.envId || ctx.config.envId
                    })
                )
                return
            }
            throw new error_1.CloudBaseError(
                '请参考文档填写 cloudbaserc 配置: https://docs.cloudbase.net/lowcode/custom-components/config/config-comps'
            )
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.CmdContext)()),
        __param(1, (0, decorators_1.Log)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object, Object]),
        __metadata('design:returntype', Promise)
    ],
    LowCodeBuildComps.prototype,
    'execute',
    null
)
LowCodeBuildComps = __decorate(
    [
        (0, common_1.ICommand)({
            supportPrivate: true
        })
    ],
    LowCodeBuildComps
)
exports.LowCodeBuildComps = LowCodeBuildComps
let LowCodeDebugComps = class LowCodeDebugComps extends common_1.Command {
    get options() {
        return {
            cmd: 'lowcode',
            childCmd: 'debug',
            options: [
                {
                    flags: '--verbose',
                    desc: '是否打印详细日志'
                },
                {
                    flags: '--debug-port <debugPort>',
                    desc: '调试端口，默认是8388'
                },
                {
                    flags: '--wx-devtool-path <wxDevtoolPath>',
                    desc: '微信开发者工具的安装路径'
                }
            ],
            desc: '调试组件库',
            requiredEnvId: false
        }
    }
    execute(ctx, options, log) {
        var _a
        return __awaiter(this, void 0, void 0, function* () {
            const config = ctx.config.lowcodeCustomComponents
            const privateSettings = (0, utils_1.getPrivateSettings)(ctx.config, this.options.cmd)
            if (config) {
                const cmdConfig = (0, utils_2.getCmdConfig)(ctx.config, this.options)
                const mergesOptions = (0, utils_2.getMergedOptions)(cmdConfig, options)
                yield lowcodeCli.graceDebugComps(
                    Object.assign(Object.assign({}, config), {
                        context: config.context || process.cwd(),
                        debugPort:
                            (mergesOptions === null || mergesOptions === void 0
                                ? void 0
                                : mergesOptions.debugPort) || 8388,
                        logger: log,
                        wxDevtoolPath:
                            mergesOptions === null || mergesOptions === void 0
                                ? void 0
                                : mergesOptions.wxDevtoolPath,
                        debugBaseUrl:
                            (_a =
                                privateSettings === null || privateSettings === void 0
                                    ? void 0
                                    : privateSettings.endpoints) === null || _a === void 0
                                ? void 0
                                : _a.editor,
                        envId: ctx.envId || ctx.config.envId
                    })
                )
                return
            }
            throw new error_1.CloudBaseError(
                '请参考文档填写 cloudbaserc 配置: https://docs.cloudbase.net/lowcode/custom-components/config/config-comps'
            )
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.CmdContext)()),
        __param(1, (0, decorators_1.ArgsOptions)()),
        __param(2, (0, decorators_1.Log)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object, Object, Object]),
        __metadata('design:returntype', Promise)
    ],
    LowCodeDebugComps.prototype,
    'execute',
    null
)
LowCodeDebugComps = __decorate(
    [
        (0, common_1.ICommand)({
            supportPrivate: true
        })
    ],
    LowCodeDebugComps
)
exports.LowCodeDebugComps = LowCodeDebugComps
let LowCodePublishComps = class LowCodePublishComps extends common_1.Command {
    get options() {
        return {
            cmd: 'lowcode',
            childCmd: 'publish',
            options: [
                {
                    flags: '--verbose',
                    desc: '是否打印详细日志'
                },
                {
                    flags: '--admin',
                    desc: '是否使用admin接口',
                    hideHelp: true
                }
            ],
            desc: '发布组件库',
            requiredEnvId: false
        }
    }
    execute(ctx, log, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = ctx.config.lowcodeCustomComponents
            if (config) {
                const mergesOptions = (0, utils_2.getMergedOptions)(
                    (0, utils_2.getCmdConfig)(ctx.config, this.options),
                    options
                )
                yield lowcodeCli.gracePublishComps(
                    Object.assign(Object.assign({}, config), {
                        context: config.context || process.cwd(),
                        logger: log,
                        privateSettings: (0, utils_1.getPrivateSettings)(
                            ctx.config,
                            this.options.cmd
                        ),
                        isAdmin: Boolean(mergesOptions.admin),
                        envId: ctx.envId || ctx.config.envId
                    })
                )
                log.success('组件库 - 已同步到云端，请到低码控制台发布该组件库！')
                return
            }
            throw new error_1.CloudBaseError(
                '请参考文档填写 cloudbaserc 配置: https://docs.cloudbase.net/lowcode/custom-components/config/config-comps'
            )
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.CmdContext)()),
        __param(1, (0, decorators_1.Log)()),
        __param(2, (0, decorators_1.ArgsOptions)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object, decorators_1.Logger, Object]),
        __metadata('design:returntype', Promise)
    ],
    LowCodePublishComps.prototype,
    'execute',
    null
)
LowCodePublishComps = __decorate(
    [(0, common_1.ICommand)({ supportPrivate: true })],
    LowCodePublishComps
)
exports.LowCodePublishComps = LowCodePublishComps
let LowCodePublishVersionComps = class LowCodePublishVersionComps extends common_1.Command {
    get options() {
        return {
            cmd: 'lowcode',
            childCmd: 'publishVersion',
            options: [
                {
                    flags: '--verbose',
                    desc: '是否打印详细日志'
                },
                {
                    flags: '--comment <comment>',
                    desc: '版本备注'
                },
                {
                    flags: '--tag <version>',
                    desc: '版本号'
                },
                {
                    flags: '--admin',
                    desc: '是否使用admin接口',
                    hideHelp: true
                }
            ],
            desc: '发布组件库版本',
            requiredEnvId: false
        }
    }
    execute(ctx, options, log) {
        return __awaiter(this, void 0, void 0, function* () {
            const { tag, comment, admin } =
                (0, utils_2.getMergedOptions)(
                    (0, utils_2.getCmdConfig)(ctx.config, this.options),
                    options
                ) || {}
            if (!comment) {
                throw new error_1.CloudBaseError('请使用 --comment 填写版本注释')
            }
            if (!tag) {
                throw new error_1.CloudBaseError('请使用 --tag 填写符合semver的版本号')
            }
            if (!semver.valid(tag)) {
                log.error('组件库版本不符合semver标准')
                return
            }
            const config = ctx.config.lowcodeCustomComponents
            if (!config) {
                throw new error_1.CloudBaseError(
                    '组件库 - 请添加组件库配置到cloudbaserc.json 以使用该命令'
                )
            }
            const res = yield lowcodeCli.publishVersion(
                Object.assign(Object.assign({}, config), {
                    context: config.context || process.cwd(),
                    logger: log,
                    isAdmin: options.admin,
                    privateSettings: (0, utils_1.getPrivateSettings)(ctx.config, this.options.cmd),
                    envId: ctx.envId || ctx.config.envId
                }),
                comment,
                tag
            )
            if (res.data.code === 200) {
                log.success('组件库 - 已发布新版本！')
                return
            }
            if (res.data.code === 100) {
                log.error('组件库 - 无待发布版本')
                return
            }
            if (res.data.code === 201) {
                log.error('组件库 - comment 重复， 请使用有意义的comment')
                return
            } else {
                if (res.data.msg) {
                    log.error(`组件库 - ${res.data.msg} RequestId: ${res.requestId}`)
                } else {
                    log.error('组件库 - 未知错误')
                }
                return
            }
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.CmdContext)()),
        __param(1, (0, decorators_1.ArgsOptions)()),
        __param(2, (0, decorators_1.Log)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object, Object, decorators_1.Logger]),
        __metadata('design:returntype', Promise)
    ],
    LowCodePublishVersionComps.prototype,
    'execute',
    null
)
LowCodePublishVersionComps = __decorate(
    [
        (0, common_1.ICommand)({
            supportPrivate: true
        })
    ],
    LowCodePublishVersionComps
)
exports.LowCodePublishVersionComps = LowCodePublishVersionComps
