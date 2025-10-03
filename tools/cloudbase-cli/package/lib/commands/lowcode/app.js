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
var __rest =
    (this && this.__rest) ||
    function (s, e) {
        var t = {}
        for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0) t[p] = s[p]
        if (s != null && typeof Object.getOwnPropertySymbols === 'function')
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]]
            }
        return t
    }
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, '__esModule', { value: true })
exports.ModelTypeSync =
    exports.LowCodeDeployApp =
    exports.LowCodeBuildAppConfig =
    exports.LowCodePreviewApp =
    exports.LowCodeBuildApp =
    exports.LowCodeWatch =
        void 0
const lodash_1 = require('lodash')
const common_1 = require('../common')
const decorators_1 = require('../../decorators')
const utils_1 = require('./utils')
const utils_2 = require('../../utils')
const cloud_api_1 = require('@cloudbase/cloud-api')
const toolbox_1 = require('@cloudbase/toolbox')
const fs_extra_1 = __importDefault(require('fs-extra'))
const dts_1 = require('../../utils/dts')
let lowcodeCli
if (process.argv.includes('lowcode')) {
    ;(0, utils_1.getLowcodeCli)().then((_) => (lowcodeCli = _))
}
let LowCodeWatch = class LowCodeWatch extends common_1.Command {
    get options() {
        return {
            cmd: 'lowcode',
            childCmd: 'watch',
            options: [
                {
                    flags: '--verbose',
                    desc: '是否打印详细日志'
                },
                {
                    flags: '--wx-devtool-path <wxDevtoolPath>',
                    desc: '微信开发者工具的安装路径'
                },
                {
                    flags: '--force-install',
                    desc: '是否忽略安装依赖包'
                },
                {
                    flags: '-p, --path <localProjectPath>',
                    desc: '本地开发的本地项目路径'
                }
            ],
            desc: '开启微搭低代码的本地构建模式',
            requiredEnvId: false
        }
    }
    execute(ctx, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = (0, utils_1.getCmdConfig)(ctx.config, this.options)
            const mergesOptions = (0, utils_1.getMergedOptions)(config, options)
            Promise.resolve()
                .then(() => __importStar(require('@cloudbase/lowcode-cli')))
                .then((res) =>
                    __awaiter(this, void 0, void 0, function* () {
                        yield res.watchApp({
                            watchPort: 8288,
                            wxDevtoolPath:
                                options === null || options === void 0
                                    ? void 0
                                    : options.wxDevtoolPath,
                            forceInstall:
                                options === null || options === void 0
                                    ? void 0
                                    : options.forceInstall,
                            projectPath:
                                options === null || options === void 0 ? void 0 : options.path
                        })
                    })
                )
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.CmdContext)()),
        __param(1, (0, decorators_1.ArgsOptions)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object, Object]),
        __metadata('design:returntype', Promise)
    ],
    LowCodeWatch.prototype,
    'execute',
    null
)
LowCodeWatch = __decorate(
    [
        (0, common_1.ICommand)({
            supportPrivate: true
        })
    ],
    LowCodeWatch
)
exports.LowCodeWatch = LowCodeWatch
let LowCodeBuildApp = class LowCodeBuildApp extends common_1.Command {
    get options() {
        return {
            cmd: 'lowcode',
            childCmd: 'build:app',
            options: [
                {
                    flags: '--clean',
                    desc: '清理构建目录'
                },
                {
                    flags: '--out <out>',
                    desc: '输出目录'
                }
            ],
            desc: '构建应用',
            requiredEnvId: false
        }
    }
    execute(ctx, log, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = (0, utils_1.getCmdConfig)(ctx.config, this.options)
            const mergesOptions = (0, utils_1.getMergedOptions)(config, options)
            yield lowcodeCli.buildApp(
                {
                    envId: ctx.envId || ctx.config.envId,
                    projectPath: process.cwd(),
                    logger: log,
                    privateSettings: (0, utils_2.getPrivateSettings)(ctx.config, this.options.cmd)
                },
                mergesOptions
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
    LowCodeBuildApp.prototype,
    'execute',
    null
)
LowCodeBuildApp = __decorate([(0, common_1.ICommand)({ supportPrivate: true })], LowCodeBuildApp)
exports.LowCodeBuildApp = LowCodeBuildApp
let LowCodePreviewApp = class LowCodePreviewApp extends common_1.Command {
    get options() {
        return {
            cmd: 'lowcode',
            childCmd: 'preview:app',
            options: [
                {
                    flags: '--wx-devtool-path <your-wx-dev-tool-path>',
                    desc: '指定微信开发者工具的安装路径'
                },
                {
                    flags: '--platform <mp|web>',
                    desc: '构建平台'
                }
            ],
            desc: '预览应用',
            requiredEnvId: false
        }
    }
    execute(ctx, log, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = (0, utils_1.getCmdConfig)(ctx.config, this.options)
            const mergesOptions = (0, utils_1.getMergedOptions)(config, options)
            yield lowcodeCli.previewApp(
                {
                    envId: ctx.envId || ctx.config.envId,
                    projectPath: process.cwd(),
                    logger: log,
                    privateSettings: (0, utils_2.getPrivateSettings)(ctx.config, this.options.cmd)
                },
                mergesOptions
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
    LowCodePreviewApp.prototype,
    'execute',
    null
)
LowCodePreviewApp = __decorate(
    [(0, common_1.ICommand)({ supportPrivate: true })],
    LowCodePreviewApp
)
exports.LowCodePreviewApp = LowCodePreviewApp
let LowCodeBuildAppConfig = class LowCodeBuildAppConfig extends common_1.Command {
    get options() {
        return {
            cmd: 'lowcode',
            childCmd: 'build:app-config',
            options: [
                {
                    flags: '--out <out>',
                    desc: '输出目录'
                },
                {
                    flags: '--build-type-list <type...>',
                    desc: '输出目录'
                },
                {
                    flags: '--domain <domain>',
                    desc: '托管域名'
                }
            ],
            desc: '构建应用配置',
            requiredEnvId: false
        }
    }
    execute(ctx, log, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = (0, utils_1.getCmdConfig)(ctx.config, this.options)
            const mergesOptions = (0, utils_1.getMergedOptions)(config, options)
            yield lowcodeCli.buildAppConfig(
                {
                    envId: ctx.envId || ctx.config.envId,
                    projectPath: process.cwd(),
                    logger: log,
                    privateSettings: (0, utils_2.getPrivateSettings)(ctx.config, this.options.cmd)
                },
                mergesOptions
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
    LowCodeBuildAppConfig.prototype,
    'execute',
    null
)
LowCodeBuildAppConfig = __decorate(
    [(0, common_1.ICommand)({ supportPrivate: true })],
    LowCodeBuildAppConfig
)
exports.LowCodeBuildAppConfig = LowCodeBuildAppConfig
let LowCodeDeployApp = class LowCodeDeployApp extends common_1.Command {
    get options() {
        return {
            cmd: 'lowcode',
            childCmd: 'publish:app',
            options: [
                {
                    flags: '--src <src>',
                    desc: '部署目录'
                },
                {
                    flags: '--sync-cloud',
                    desc: '是否同步云端部署记录'
                }
            ],
            desc: '发布应用',
            requiredEnvId: false
        }
    }
    execute(ctx, log, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let credential
            const privateSettings = (0, utils_2.getPrivateSettings)(ctx.config, this.options.cmd)
            const config = (0, utils_1.getCmdConfig)(ctx.config, this.options)
            const _a = (0, utils_1.getMergedOptions)(config, options),
                { src } = _a,
                restMergedOptions = __rest(_a, ['src'])
            if (ctx.hasPrivateSettings) {
                process.env.IS_PRIVATE = 'true'
                credential = privateSettings.credential
            } else {
                credential = yield utils_2.authSupevisor.getLoginState()
            }
            yield lowcodeCli.deployApp(
                {
                    envId: ctx.envId || ctx.config.envId,
                    projectPath: process.cwd(),
                    logger: log,
                    privateSettings
                },
                Object.assign(Object.assign({ credential }, restMergedOptions), {
                    projectPath: src || restMergedOptions.projectPath
                })
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
    LowCodeDeployApp.prototype,
    'execute',
    null
)
LowCodeDeployApp = __decorate([(0, common_1.ICommand)({ supportPrivate: true })], LowCodeDeployApp)
exports.LowCodeDeployApp = LowCodeDeployApp
let ModelTypeSync = class ModelTypeSync extends common_1.Command {
    get options() {
        return {
            cmd: 'sync-model-dts',
            options: [
                {
                    flags: '--envId <envId>',
                    desc: '环境 ID'
                }
            ],
            desc: '同步数据模型类型定义文件',
            requiredEnvId: true,
            autoRunLogin: true
        }
    }
    execute(ctx, log, options) {
        return __awaiter(this, void 0, void 0, function* () {
            log.info('同步中...')
            if (!(yield fs_extra_1.default.pathExists('cloudbaserc.json'))) {
                yield fs_extra_1.default.writeFile(
                    'cloudbaserc.json',
                    JSON.stringify(
                        {
                            version: '2.0',
                            envId: ctx.envId
                        },
                        null,
                        2
                    ),
                    'utf8'
                )
            }
            if (!(yield fs_extra_1.default.pathExists('tsconfig.json'))) {
                yield fs_extra_1.default.writeFile(
                    'tsconfig.json',
                    JSON.stringify(
                        {
                            compilerOptions: {
                                allowJs: true
                            }
                        },
                        null,
                        2
                    ),
                    'utf8'
                )
            } else {
                const config = yield fs_extra_1.default.readJson('tsconfig.json', 'utf8')
                ;(0, lodash_1.set)(config, 'compilerOptions.allowJs', true)
                yield fs_extra_1.default.writeFile(
                    'tsconfig.json',
                    JSON.stringify(config, null, 2),
                    'utf8'
                )
            }
            const cloudService = yield getCloudServiceInstance(ctx)
            const datasourceList = yield cloudService.lowcode.request('DescribeDataSourceList', {
                EnvId: ctx.envId,
                PageIndex: 1,
                PageSize: 1000,
                QuerySystemModel: true,
                QueryConnector: 0
            })
            const rows = datasourceList.Data.Rows
            const dataModelList = rows.map((item) => ({
                name: item.Name,
                schema: JSON.parse(item.Schema),
                title: item.Title
            }))
            const dts = yield (0, dts_1.generateDataModelDTS)(dataModelList)
            const dtsFileName = 'cloud-models.d.ts'
            yield fs_extra_1.default.writeFile(dtsFileName, dts)
            log.success('同步数据模型类型定义文件成功。文件名称：' + dtsFileName)
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
    ModelTypeSync.prototype,
    'execute',
    null
)
ModelTypeSync = __decorate([(0, common_1.ICommand)({ supportPrivate: true })], ModelTypeSync)
exports.ModelTypeSync = ModelTypeSync
function getCloudServiceInstance(ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        let credential
        if (ctx.hasPrivateSettings) {
            process.env.IS_PRIVATE = 'true'
            const privateSettings = (0, utils_2.getPrivateSettings)(ctx.config, this.options.cmd)
            credential = privateSettings.credential
        } else {
            credential = yield utils_2.authSupevisor.getLoginState()
        }
        return {
            lowcode: cloud_api_1.CloudApiService.getInstance({
                service: 'lowcode',
                proxy: (0, toolbox_1.getProxy)(),
                credential,
                version: '2021-01-08'
            }),
            tcb: cloud_api_1.CloudApiService.getInstance({
                service: 'tcb',
                proxy: (0, toolbox_1.getProxy)(),
                credential
            })
        }
    })
}
