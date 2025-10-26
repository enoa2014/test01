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
exports.FunRunCommand = exports.FunDeployCommand = exports.FunListCommand = void 0
const functions_framework_1 = require('@cloudbase/functions-framework')
const fs_extra_1 = __importDefault(require('fs-extra'))
const inquirer_1 = __importDefault(require('inquirer'))
const path_1 = __importDefault(require('path'))
const decorators_1 = require('../../decorators')
const run_1 = require('../../run')
const utils_1 = require('../../utils')
const common_1 = require('../common')
const constants_1 = require('../constants')
const utils_2 = require('../utils')
const nodemon = (() => {
    try {
        return require('nodemon')
    } catch (_a) {
        return null
    }
})()
const scfService = utils_1.CloudApiService.getInstance('tcb')
let FunListCommand = class FunListCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'fun',
            childCmd: 'list',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                }
            ],
            requiredEnvId: false,
            autoRunLogin: true,
            desc: '查看函数式托管服务列表'
        }
    }
    execute(envId, log) {
        var _a
        return __awaiter(this, void 0, void 0, function* () {
            const loading = (0, utils_1.loadingFactory)()
            if (!envId) {
                envId = yield _selectEnv()
            } else {
                log.info(`当前环境 Id：${envId}`)
            }
            try {
                loading.start('获取函数式托管服务列表中…')
                let serverListRes = yield scfService
                    .request('DescribeCloudBaseRunServers', {
                        EnvId: envId,
                        Limit: 100,
                        Offset: 0
                    })
                    .finally(() => loading.stop())
                const serverList =
                    (_a = serverListRes.CloudBaseRunServerSet) === null || _a === void 0
                        ? void 0
                        : _a.filter((item) => item.Tag === 'function')
                const head = ['服务名称', '状态', '创建时间', '更新时间']
                const tableData = serverList.map((serverItem) => [
                    serverItem.ServerName,
                    serverItem.Status,
                    serverItem.CreatedTime,
                    serverItem.UpdatedTime
                ])
                ;(0, utils_1.printHorizontalTable)(head, tableData)
            } catch (e) {
                log.error('获取函数式托管服务列表失败：' + e.message)
            }
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.EnvId)()),
        __param(1, (0, decorators_1.Log)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object, decorators_1.Logger]),
        __metadata('design:returntype', Promise)
    ],
    FunListCommand.prototype,
    'execute',
    null
)
FunListCommand = __decorate([(0, common_1.ICommand)()], FunListCommand)
exports.FunListCommand = FunListCommand
let FunDeployCommand = class FunDeployCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'fun',
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
                    flags: '--appId <appId>',
                    desc: '微信 AppId'
                },
                {
                    flags: '--source <source>',
                    desc: '目标函数文件所在目录路径。默认为当前路径'
                },
                {
                    flags: '--includeNodeModules',
                    desc: '包含本地 node_modules 目录，默认为 false 不包含'
                },
                {
                    flags: '--functionsConfigFile <functionsConfigFile>',
                    desc: '多函数定义配置文件，默认为 ./cloudbase-functions.json'
                }
            ],
            requiredEnvId: false,
            autoRunLogin: true,
            desc: '部署函数式托管代码'
        }
    }
    execute(envId, log, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let { serviceName, appId, source, includeNodeModules = false } = options
            const target = 'main'
            source = path_1.default.resolve(source || process.cwd())
            const functionsConfigFile = options.functionsConfigFile || 'cloudbase-functions.json'
            let multiFunctionsConfig = null
            if (
                functionsConfigFile &&
                (yield fs_extra_1.default.exists(
                    path_1.default.resolve(source, functionsConfigFile)
                ))
            ) {
                try {
                    multiFunctionsConfig = (0, functions_framework_1.loadFunctionsConfig)(
                        functionsConfigFile
                    )
                } catch (err) {
                    log.error(`多函数定义配置文件 ${functionsConfigFile} 配置文件有误，请检查`)
                    log.error(err)
                    return
                }
            }
            if (!envId) {
                envId = yield _selectEnv()
            } else {
                log.info(`当前环境 Id：${envId}`)
            }
            if (!serviceName) {
                let pkgName = ''
                try {
                    const pkg = yield fs_extra_1.default.readJSON(
                        path_1.default.join(source, 'package.json')
                    )
                    pkgName = pkg.name
                } catch (e) {}
                serviceName = yield _inputServiceName(pkgName)
            }
            if (!appId) {
                appId = yield _inputAppId()
            }
            const loading = (0, utils_1.loadingFactory)()
            const fetchSvrRes = yield scfService.request('DescribeCloudBaseRunServer', {
                EnvId: envId,
                ServerName: serviceName,
                Limit: 1,
                Offset: 0
            })
            if (fetchSvrRes.ServerName && !_isFunRunService(fetchSvrRes.Tag)) {
                log.error(
                    `${serviceName} 服务已存在，但不是一个函数式托管服务，请使用另外的服务名称`
                )
                return
            }
            if (!fetchSvrRes.ServerName) {
                try {
                    loading.start('正在创建服务…')
                    yield scfService.request('EstablishCloudBaseRunServerWx', {
                        EnvId: envId,
                        ServiceName: serviceName,
                        IsPublic: true,
                        OpenAccessTypes: ['MINIAPP', 'PUBLIC'],
                        ServiceBaseConfig: {
                            PublicAccess: true,
                            Cpu: 1,
                            Mem: 2,
                            MinNum: 0,
                            MaxNum: 5,
                            PolicyType: 'cpu',
                            PolicyThreshold: 60,
                            CustomLogs: 'stdout',
                            EnvParams: '',
                            OperatorRemark: '',
                            InitialDelaySeconds: 2,
                            PolicyDetails: [
                                {
                                    PolicyThreshold: 60,
                                    PolicyType: 'cpu'
                                }
                            ],
                            BuildDir: '',
                            Dockerfile: 'Dockerfile',
                            HasDockerfile: true,
                            InternalAccess: 'open',
                            Port: 3000,
                            Tag: 'function'
                        },
                        WxBuffer: ''
                    })
                    loading.succeed('创建服务成功')
                } catch (e) {
                    loading.stop()
                    log.error('创建服务失败：' + e.message)
                    return
                }
            }
            let packageName, packageVersion
            try {
                loading.start('正在上传代码包…')
                const { PackageName, PackageVersion } = yield (0, run_1.packageDeploy)({
                    envId,
                    serviceName,
                    filePath: source,
                    fileToIgnore: ['logs', 'logs/**/*'].concat(
                        includeNodeModules ? [] : ['node_modules', 'node_modules/**/*']
                    )
                })
                packageName = PackageName
                packageVersion = PackageVersion
                loading.stop()
            } catch (e) {
                loading.stop()
                log.error('上传代码包失败：' + e.message)
                return
            }
            try {
                loading.start('正在创建发布任务…')
                yield scfService.request('SubmitServerRelease', {
                    EnvId: envId,
                    WxAppId: appId,
                    ServerName: serviceName,
                    PackageName: packageName,
                    PackageVersion: packageVersion,
                    BuildDir: '.',
                    DeployType: 'package',
                    ReleaseType: 'FULL',
                    HasDockerfile: false,
                    Dockerfile: '',
                    Port: 3000,
                    BuildPacks: {
                        BaseImage: 'Node.js-LTS',
                        EntryPoint: 'node index.js',
                        RepoLanguage: 'Node.js',
                        UploadFilename: ''
                    },
                    VersionRemark: ''
                })
                loading.succeed(
                    `发布任务创建成功，请前往 https://cloud.weixin.qq.com/cloudrun/service/${serviceName} 查看任务详情`
                )
            } catch (e) {
                loading.stop()
                log.error('创建发布任务失败：' + e.message)
            }
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.EnvId)()),
        __param(1, (0, decorators_1.Log)()),
        __param(2, (0, decorators_1.ArgsOptions)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object, decorators_1.Logger, Object]),
        __metadata('design:returntype', Promise)
    ],
    FunDeployCommand.prototype,
    'execute',
    null
)
FunDeployCommand = __decorate([(0, common_1.ICommand)()], FunDeployCommand)
exports.FunDeployCommand = FunDeployCommand
let FunRunCommand = class FunRunCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'fun',
            childCmd: 'run',
            options: [
                {
                    flags: '--source <source>',
                    desc: '目标函数文件所在目录路径，默认为当前路径'
                },
                {
                    flags: '--port <port>',
                    desc: '监听的端口，默认为 3000'
                },
                {
                    flags: '-w, --watch',
                    desc: '是否启用热重启模式，如启用，将会在文件变更时自动重启服务，默认为 false'
                },
                {
                    flags: '--dry-run',
                    desc: '是否不启动服务，只验证代码可以正常加载，默认为 false'
                },
                {
                    flags: '--logDirname <logDirname>',
                    desc: '日志文件目录，默认为 ./logs'
                },
                {
                    flags: '--functionsConfigFile <functionsConfigFile>',
                    desc: '多函数定义配置文件，默认为 ./cloudbase-functions.json'
                }
            ],
            requiredEnvId: false,
            desc: '本地运行函数式托管代码'
        }
    }
    execute(logger) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = process.argv.slice(2)
            const watchFlag = ['--watch', '-w']
            const defaultIgnoreFiles = ['logs/*.*']
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
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [decorators_1.Logger]),
        __metadata('design:returntype', Promise)
    ],
    FunRunCommand.prototype,
    'execute',
    null
)
FunRunCommand = __decorate([(0, common_1.ICommand)()], FunRunCommand)
exports.FunRunCommand = FunRunCommand
function _selectEnv() {
    return __awaiter(this, void 0, void 0, function* () {
        return (0, utils_2.selectEnv)({ source: [constants_1.EnvSource.MINIAPP] })
    })
}
function _inputServiceName(defaultVal = '') {
    return __awaiter(this, void 0, void 0, function* () {
        const questions = [
            {
                type: 'input',
                name: 'serviceName',
                message:
                    '请输入服务名称（只能包含数字、小写字母和-，只能以小写字母开头，最多 20字符）',
                default: defaultVal,
                validate: (val) => {
                    return /^[a-z][a-z0-9-]{0,19}$/.test(val) ? true : '请输入正确的服务名称'
                }
            }
        ]
        const answers = yield inquirer_1.default.prompt(questions)
        return answers['serviceName']
    })
}
function _inputAppId(defaultVal = '') {
    return __awaiter(this, void 0, void 0, function* () {
        const questions = [
            {
                type: 'input',
                name: 'appId',
                message: '请输入微信 AppID',
                validate: (val) => (val ? true : '请输入微信 AppID'),
                default: defaultVal
            }
        ]
        const answers = yield inquirer_1.default.prompt(questions)
        return answers['appId']
    })
}
function _isFunRunService(tagStr) {
    if (!tagStr) return false
    const tags = tagStr.split(',')
    const tagList = tags.map((item) => item.split(':')[0])
    return tagList.includes('function')
}
