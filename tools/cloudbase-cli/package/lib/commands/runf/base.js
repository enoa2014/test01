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
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, '__esModule', { value: true })
exports.RunfRunCommand = exports.RunfDownloadCommand = exports.RunfDeployCommand = void 0
const functions_framework_1 = require('@cloudbase/functions-framework')
const iac_core_1 = require('@cloudbase/iac-core')
const camelcase_keys_1 = __importDefault(require('camelcase-keys'))
const inquirer_1 = __importDefault(require('inquirer'))
const nodemon = (() => {
    try {
        return require('nodemon')
    } catch (_a) {
        return null
    }
})()
const path_1 = __importDefault(require('path'))
const decorators_1 = require('../../decorators')
const common_1 = require('../common')
const constants_1 = require('../constants')
const utils_1 = require('../utils')
const { CloudAPI } = iac_core_1.CloudAPI
let RunfDeployCommand = class RunfDeployCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'cloudrunfunction',
            childCmd: 'deploy',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                },
                {
                    flags: '-s, --serviceName <serviceName>',
                    desc: '服务名称'
                },
                {
                    flags: '--source <source>',
                    desc: '目标函数文件所在目录路径。默认为当前路径'
                }
            ],
            requiredEnvId: false,
            autoRunLogin: true,
            desc: '部署云函数 2.0 服务'
        }
    }
    execute(ctx, envId, log, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let { serviceName, source } = options
            const targetDir = path_1.default.resolve(source || process.cwd())
            if (!envId) {
                const envConfig = (0, camelcase_keys_1.default)(
                    yield iac_core_1.utils.loadEnv(targetDir)
                )
                if (envConfig.envId) {
                    envId = envConfig.envId
                    log.info(`当前环境 Id：${envId}`)
                } else {
                    envId = yield _selectEnv()
                }
            } else {
                log.info(`当前环境 Id：${envId}`)
            }
            if (!serviceName) {
                const { shortName } = yield (0, utils_1.getPackageJsonName)(
                    path_1.default.join(targetDir, 'package.json')
                )
                serviceName = yield _inputServiceName(shortName)
            }
            const answers = yield inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `即将开始部署，是否确认继续？`,
                    default: true
                }
            ])
            if (!answers.confirm) {
                return
            }
            yield iac_core_1.IAC.init({
                cwd: targetDir,
                getCredential: () => {
                    return (0, utils_1.getCredential)(ctx, options)
                },
                polyRepoMode: true
            })
            yield _runDeploy()
            function _runDeploy() {
                return __awaiter(this, void 0, void 0, function* () {
                    try {
                        const res = yield iac_core_1.IAC.FunctionV2.apply(
                            {
                                cwd: targetDir,
                                envId: envId,
                                name: serviceName
                            },
                            function (message) {
                                ;(0, utils_1.trackCallback)(message, log)
                            }
                        )
                        const {
                            envId: _envId,
                            name,
                            resourceType: _resourceType
                        } = res === null || res === void 0 ? void 0 : res.data
                        ;(0, utils_1.trackCallback)(
                            {
                                details: `请打开链接查看部署状态: https://tcb.cloud.tencent.com/dev?envId=${_envId}#/platform-run/service/detail?serverName=${name}&tabId=deploy&envId=${_envId}`
                            },
                            log
                        )
                    } catch (e) {
                        if (
                            (e === null || e === void 0 ? void 0 : e.action) ===
                                'UpdateCloudRunServer' &&
                            (e === null || e === void 0 ? void 0 : e.code) === 'ResourceInUse'
                        ) {
                            inquirer_1.default
                                .prompt([
                                    {
                                        type: 'confirm',
                                        name: 'confirm',
                                        message: `平台当前有部署发布任务正在运行中。确认继续部署，正在执行的部署任务将被取消，并立即部署最新的代码`,
                                        default: true
                                    }
                                ])
                                .then((answers) =>
                                    __awaiter(this, void 0, void 0, function* () {
                                        if (answers.confirm) {
                                            try {
                                                const { task } = yield CloudAPI.tcbrServiceRequest(
                                                    'DescribeServerManageTask',
                                                    {
                                                        envId,
                                                        serverName: serviceName,
                                                        taskId: 0
                                                    }
                                                )
                                                const id =
                                                    task === null || task === void 0
                                                        ? void 0
                                                        : task.id
                                                yield CloudAPI.tcbrServiceRequest(
                                                    'OperateServerManage',
                                                    {
                                                        envId,
                                                        operateType: 'cancel',
                                                        serverName: serviceName,
                                                        taskId: id
                                                    }
                                                )
                                                yield _runDeploy()
                                            } catch (e) {
                                                ;(0, utils_1.trackCallback)(
                                                    {
                                                        type: 'error',
                                                        details: e.message
                                                    },
                                                    log
                                                )
                                            }
                                        }
                                    })
                                )
                        } else {
                            ;(0, utils_1.trackCallback)(
                                {
                                    type: 'error',
                                    details: `${e.message}`,
                                    originalError: e
                                },
                                log
                            )
                        }
                    }
                })
            }
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.CmdContext)()),
        __param(1, (0, decorators_1.EnvId)()),
        __param(2, (0, decorators_1.Log)()),
        __param(3, (0, decorators_1.ArgsOptions)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object, Object, decorators_1.Logger, Object]),
        __metadata('design:returntype', Promise)
    ],
    RunfDeployCommand.prototype,
    'execute',
    null
)
RunfDeployCommand = __decorate([(0, common_1.ICommand)()], RunfDeployCommand)
exports.RunfDeployCommand = RunfDeployCommand
let RunfDownloadCommand = class RunfDownloadCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'cloudrunfunction',
            childCmd: 'download',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                },
                {
                    flags: '-s, --serviceName <serviceName>',
                    desc: '服务名称'
                },
                {
                    flags: '--source <source>',
                    desc: '目标函数文件所在目录路径。默认为当前路径'
                }
            ],
            requiredEnvId: false,
            autoRunLogin: true,
            desc: '下载云函数 2.0 服务代码'
        }
    }
    execute(ctx, envId, log, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let { serviceName, source } = options
            let targetDir = path_1.default.resolve(source || process.cwd())
            if (!envId) {
                const envConfig = (0, camelcase_keys_1.default)(
                    yield iac_core_1.utils.loadEnv(targetDir)
                )
                envId = envConfig.envId || (yield _selectEnv())
            } else {
                log.info(`当前环境 Id：${envId}`)
            }
            if (!serviceName) {
                const { shortName } = yield (0, utils_1.getPackageJsonName)(
                    path_1.default.join(targetDir, 'package.json')
                )
                serviceName = yield _inputServiceName(shortName)
                if (serviceName !== shortName) {
                    targetDir = path_1.default.join(targetDir, serviceName)
                }
            }
            const needTips = !(yield (0, utils_1.isDirectoryEmptyOrNotExists)(targetDir))
            if (needTips) {
                const answers = yield inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: `下载将覆盖 ${targetDir} 目录下的代码，是否继续？`,
                        default: true
                    }
                ])
                if (!answers.confirm) {
                    return
                }
            }
            yield iac_core_1.IAC.init({
                cwd: targetDir,
                getCredential: () => {
                    return (0, utils_1.getCredential)(ctx, options)
                },
                polyRepoMode: true
            })
            try {
                yield iac_core_1.IAC.FunctionV2.pull(
                    {
                        cwd: targetDir,
                        envId: envId,
                        name: serviceName
                    },
                    function (message) {
                        ;(0, utils_1.trackCallback)(message, log)
                    }
                )
            } catch (e) {
                ;(0, utils_1.trackCallback)(
                    {
                        type: 'error',
                        details: `${e.message}`,
                        originalError: e
                    },
                    log
                )
            }
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.CmdContext)()),
        __param(1, (0, decorators_1.EnvId)()),
        __param(2, (0, decorators_1.Log)()),
        __param(3, (0, decorators_1.ArgsOptions)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object, Object, decorators_1.Logger, Object]),
        __metadata('design:returntype', Promise)
    ],
    RunfDownloadCommand.prototype,
    'execute',
    null
)
RunfDownloadCommand = __decorate([(0, common_1.ICommand)()], RunfDownloadCommand)
exports.RunfDownloadCommand = RunfDownloadCommand
let RunfRunCommand = class RunfRunCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'cloudrunfunction',
            childCmd: 'run',
            options: [
                {
                    flags: '--source <source>',
                    desc: `目标函数文件所在目录路径，默认为当前路径
                    `
                },
                {
                    flags: '--port <port>',
                    desc: `监听的端口，默认为 3000
                    `
                },
                {
                    flags: '-w, --watch',
                    desc: `是否启用热重启模式，如启用，将会在文件变更时自动重启服务，默认为 false
                    `
                },
                {
                    flags: '--dry-run',
                    desc: `是否不启动服务，只验证代码可以正常加载，默认为 false
                    `
                },
                {
                    flags: '--logDirname <logDirname>',
                    desc: `日志文件目录，默认为 ./logs
                    `
                },
                {
                    flags: '--functionsConfigFile <functionsConfigFile>',
                    desc: `多函数定义配置文件，默认为 ./cloudbase-functions.json。
                                             环境变量: FUNCTIONS_CONFIG_FILE
                    `
                },
                {
                    flags: '--loadAllFunctions',
                    desc: `是否加载 "functionsRoot" 目录中的所有函数。默认为 false
                    `
                },
                {
                    flags: '--enableCors <enableCors>',
                    desc: `为已配置的源启用跨域资源共享（CORS），默认值为 false
                                             环境变量: ENABLE_CORS
                    `
                },
                {
                    flags: '--allowedOrigins <allowedOrigins>',
                    desc: `设置 CORS 允许的源。默认允许 localhost 和 127.0.0.1。
                                             支持通配符源，例如 ['.example.com']。
                                             多个源应该用逗号分隔。
                                             示例：--allowedOrigins .example.com,www.another.com
                                             环境变量：ALLOWED_ORIGINSS
                                             `
                },
                {
                    flags: '--extendedContext <extendedContext>',
                    desc: `用于解析 context.extendedContext 的值。""表示该功能已关闭。默认值为 null
                                             示例：--extendedContext '{"a":1,"b":2}'
                                             环境变量：EXTENDED_CONTEXT
                                             `
                }
            ],
            requiredEnvId: false,
            desc: '本地运行云函数 2.0 代码'
        }
    }
    execute(logger, ctx, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = process.argv.slice(2)
            const watchFlag = ['--watch', '-w']
            const defaultIgnoreFiles = ['logs/*.*']
            const envConfig = (0, camelcase_keys_1.default)(
                yield iac_core_1.utils.loadEnv(process.cwd())
            )
            const credential = yield (0, utils_1.getCredential)(ctx, options)
            process.env.EXTENDED_CONTEXT = JSON.stringify({
                tmpSecret: {
                    secretId: credential.secretId,
                    secretKey: credential.secretKey,
                    token: credential.token
                },
                source: 'local_dev',
                envId: envConfig.envId
            })
            if (watchFlag.some((flag) => args.includes(flag))) {
                const cmd = args.filter((arg) => !watchFlag.includes(arg)).join(' ')
                if (!nodemon) {
                    throw new Error(
                        '缺少开发依赖 nodemon，独立发行版已不内置。请在本地开发环境中安装再使用该命令。'
                    )
                }
                nodemon({
                    script: '',
                    exec: `${process.argv[1]} ${cmd}`,
                    watchOptions: {
                        usePolling: true,
                        ignorePermissionErrors: true,
                        ignored: defaultIgnoreFiles.join(','),
                        persistent: true,
                        interval: 500
                    }
                })
                    .on('start', () => {
                        logger.info(
                            'Initializing server in watch mode. Changes in source files will trigger a restart.'
                        )
                    })
                    .on('quit', (e) => {
                        logger.info(`Nodemon quit with code ${e}.`)
                        process.exit(0)
                    })
                    .on('restart', (e) => {
                        var _a, _b
                        logger.info(
                            `Server restarted due to changed files: ${(_b = (_a = e === null || e === void 0 ? void 0 : e.matched) === null || _a === void 0 ? void 0 : _a.result) === null || _b === void 0 ? void 0 : _b.join(', ')}`
                        )
                    })
                    .on('log', (e) => {
                        logger.info(`[nodemon ${e.type}] ${e.message}`)
                    })
                    .on('crash', () => {
                        logger.error(`Server crashed.`)
                        process.exit(1)
                    })
                    .on('exit', (e) => {
                        logger.info(`Server exited with code ${e}.`)
                    })
            } else {
                ;(0, functions_framework_1.runCLI)()
            }
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.Log)()),
        __param(1, (0, decorators_1.CmdContext)()),
        __param(2, (0, decorators_1.ArgsOptions)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [decorators_1.Logger, Object, Object]),
        __metadata('design:returntype', Promise)
    ],
    RunfRunCommand.prototype,
    'execute',
    null
)
RunfRunCommand = __decorate([(0, common_1.ICommand)()], RunfRunCommand)
exports.RunfRunCommand = RunfRunCommand
function _selectEnv() {
    return __awaiter(this, void 0, void 0, function* () {
        return (0, utils_1.selectEnv)({
            source: [constants_1.EnvSource.MINIAPP, constants_1.EnvSource.QCLOUD]
        })
    })
}
function _inputServiceName(defaultVal = '') {
    return __awaiter(this, void 0, void 0, function* () {
        const questions = [
            {
                type: 'input',
                name: 'serviceName',
                message: '请输入服务名称',
                default: defaultVal,
                validate: (val) => {
                    const isValid =
                        !val.startsWith('lcap') &&
                        !val.startsWith('lowcode') &&
                        /^[A-Za-z][\w-_]{0,43}[A-Za-z0-9]$/.test(val)
                    return isValid
                        ? true
                        : '支持大小写字母、数字、-和_，但必须以字母开头、以字母和数字结尾，不支持以lcap、lowcode开头，最长45个字符'
                }
            }
        ]
        const answers = yield inquirer_1.default.prompt(questions)
        return answers['serviceName']
    })
}
