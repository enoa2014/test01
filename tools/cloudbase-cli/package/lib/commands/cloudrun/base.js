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
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, '__esModule', { value: true })
exports.CloudRunRunCommand =
    exports.CloudRunDeployCommand =
    exports.CloudRunDeleteCommand =
    exports.CloudRunDownloadCommand =
    exports.CloudRunListCommand =
    exports.CloudRunInitCommand =
    exports.getAgentService =
    exports.getCloudrunService =
        void 0
const functions_framework_1 = require('@cloudbase/functions-framework')
const iac_core_1 = require('@cloudbase/iac-core')
const manager_node_1 = __importDefault(require('@cloudbase/manager-node'))
const toolbox_1 = require('@cloudbase/toolbox')
const camelcase_keys_1 = __importDefault(require('camelcase-keys'))
const chalk_1 = __importDefault(require('chalk'))
const cli_table3_1 = __importDefault(require('cli-table3'))
const execa_1 = __importDefault(require('execa'))
const fs_extra_1 = __importDefault(require('fs-extra'))
const inquirer_1 = __importDefault(require('inquirer'))
const nodemon = (() => {
    try {
        return require('nodemon')
    } catch (_a) {
        return null
    }
})()
const open_1 = __importDefault(require('open'))
const ora_1 = __importDefault(require('ora'))
const path_1 = __importDefault(require('path'))
const decorators_1 = require('../../decorators')
const utils_1 = require('../../utils')
const common_1 = require('../common')
const constants_1 = require('../constants')
const utils_2 = require('../utils')
const { CloudAPI } = iac_core_1.CloudAPI
const AccessType = {
    OA: 'OA',
    PUBLIC: 'PUBLIC',
    MINIAPP: 'MINIAPP',
    VPC: 'VPC'
}
const ResourceTitle = {
    container: '容器型云托管',
    function: '函数型云托管'
}
function getCloudrunService(envId) {
    return __awaiter(this, void 0, void 0, function* () {
        const region = yield (0, toolbox_1.getRegion)()
        const { secretId, secretKey, token } = yield (0, utils_1.checkAndGetCredential)(true)
        const app = new manager_node_1.default({
            region,
            token,
            envId,
            secretId,
            secretKey,
            proxy: (0, utils_1.getProxy)()
        })
        return app.cloudrun
    })
}
exports.getCloudrunService = getCloudrunService
function getAgentService(envId) {
    return __awaiter(this, void 0, void 0, function* () {
        const region = yield (0, toolbox_1.getRegion)()
        const { secretId, secretKey, token } = yield (0, utils_1.checkAndGetCredential)(true)
        const app = new manager_node_1.default({
            region,
            token,
            envId,
            secretId,
            secretKey,
            proxy: (0, utils_1.getProxy)()
        })
        return app.agent
    })
}
exports.getAgentService = getAgentService
let CloudRunInitCommand = class CloudRunInitCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'cloudrun',
            childCmd: 'init',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 ID'
                },
                {
                    flags: '-s, --serviceName <serviceName>',
                    desc: '服务名称'
                },
                {
                    flags: '--template <template>',
                    desc: '模板名称'
                },
                {
                    flags: '--targetPath <targetPath>',
                    desc: '项目初始化目标路径（绝对路径或相对路径，默认: 当前目录）'
                }
            ],
            requiredEnvId: false,
            autoRunLogin: true,
            desc: '初始化云托管服务代码项目'
        }
    }
    execute(ctx, envId, log, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let { serviceName, targetPath, template } = options
            const targetDir = path_1.default.resolve(targetPath || process.cwd())
            if (!envId) {
                envId = yield _selectEnv()
            }
            const cloudrunService = yield getCloudrunService(envId)
            if (!serviceName) {
                serviceName = yield _inputServiceName()
            }
            if (!template) {
                const templates = yield cloudrunService.getTemplates()
                const { templateId } = yield inquirer_1.default.prompt([
                    {
                        type: 'list',
                        name: 'templateId',
                        message: '请选择模板',
                        choices: templates.map((t) => ({
                            name: `${t.title}(${t.identifier})`,
                            value: t.identifier
                        }))
                    }
                ])
                template = templateId
            }
            const spinner = (0, ora_1.default)({
                text: '正在初始化项目代码...',
                color: 'blue'
            }).start()
            try {
                const { projectDir } = yield cloudrunService.init({
                    serverName: serviceName,
                    template,
                    targetPath: targetDir
                })
                yield (0, utils_2.upsertCloudbaserc)(
                    path_1.default.resolve(targetDir, serviceName),
                    {
                        envId,
                        cloudrun: { name: serviceName }
                    }
                )
                spinner.succeed('项目初始化成功')
                console.log(chalk_1.default.green(`项目路径：${projectDir}`))
            } catch (e) {
                spinner.fail('项目初始化失败')
                const error = e instanceof Error ? e : new Error(String(e))
                log.error(error.message)
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
        __metadata('design:paramtypes', [Object, String, decorators_1.Logger, Object]),
        __metadata('design:returntype', Promise)
    ],
    CloudRunInitCommand.prototype,
    'execute',
    null
)
CloudRunInitCommand = __decorate([(0, common_1.ICommand)()], CloudRunInitCommand)
exports.CloudRunInitCommand = CloudRunInitCommand
let CloudRunListCommand = class CloudRunListCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'cloudrun',
            childCmd: 'list',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 ID'
                },
                {
                    flags: '--pageSize <pageSize>',
                    desc: '每页数量（默认值: 10）',
                    defaultValue: 10
                },
                {
                    flags: '--pageNum <pageNum>',
                    desc: '页码（默认值: 1）',
                    defaultValue: 1
                },
                {
                    flags: '--serviceName <serviceName>',
                    desc: '服务名称筛选'
                },
                {
                    flags: '--serverType <serverType>',
                    desc: '服务类型筛选（可选值: function | container）',
                    choices: ['function', 'container']
                }
            ],
            requiredEnvId: false,
            autoRunLogin: true,
            desc: '查看云托管服务列表'
        }
    }
    execute(ctx, envId, log, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { pageSize, pageNum, serviceName, serverType } = options
            if (!envId) {
                envId = yield _selectEnv()
            }
            log.info(`当前环境：${envId}`)
            const cloudrunService = yield getCloudrunService(envId)
            const services = yield cloudrunService.list({
                pageSize: parseInt(pageSize),
                pageNum: parseInt(pageNum),
                serverName: serviceName,
                serverType: serverType
            })
            const table = new cli_table3_1.default({
                head: ['服务名称', '类型', '更新时间', '运行状态', '公网访问'],
                style: {
                    head: ['green']
                }
            })
            const serverTypeTitleMap = {
                function: '函数型服务',
                container: '容器型服务'
            }
            services.ServerList.forEach((service) => {
                table.push([
                    service.ServerName,
                    serverTypeTitleMap[service.ServerType] || service.ServerType,
                    service.UpdateTime,
                    service.Status,
                    isPublicAccessOpen(service.AccessTypes) ? '允许' : '不允许'
                ])
            })
            console.log(table.toString())
            function isPublicAccessOpen(accessTypes) {
                return (
                    (accessTypes === null || accessTypes === void 0
                        ? void 0
                        : accessTypes.includes(AccessType.PUBLIC)) || false
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
        __metadata('design:paramtypes', [Object, String, decorators_1.Logger, Object]),
        __metadata('design:returntype', Promise)
    ],
    CloudRunListCommand.prototype,
    'execute',
    null
)
CloudRunListCommand = __decorate([(0, common_1.ICommand)()], CloudRunListCommand)
exports.CloudRunListCommand = CloudRunListCommand
let CloudRunDownloadCommand = class CloudRunDownloadCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'cloudrun',
            childCmd: 'download',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 ID'
                },
                {
                    flags: '-s, --serviceName <serviceName>',
                    desc: '服务名称',
                    required: true
                },
                {
                    flags: '--targetPath <targetPath>',
                    desc: '代码下载目标路径（绝对路径或相对路径，默认: 当前目录）',
                    defaultValue: process.cwd()
                },
                {
                    flags: '--force',
                    desc: '强制覆盖，不提示确认',
                    defaultValue: false
                }
            ],
            requiredEnvId: false,
            autoRunLogin: true,
            desc: '下载云托管服务代码'
        }
    }
    execute(ctx, envId, log, options) {
        var _a
        return __awaiter(this, void 0, void 0, function* () {
            let { serviceName, targetPath, force } = options
            let targetDir = path_1.default.resolve(targetPath || process.cwd())
            if (!envId) {
                envId = yield _selectEnv()
            }
            log.info(`当前环境：${envId}`)
            const cloudrunService = yield getCloudrunService(envId)
            const maybeInProject = yield fs_extra_1.default.pathExists(
                path_1.default.join(targetDir, 'README.md')
            )
            if (!serviceName) {
                let defaultName = ''
                if (maybeInProject) {
                    const config = yield (0, utils_2.getCloudbaserc)(targetDir)
                    if (
                        (_a =
                            config === null || config === void 0 ? void 0 : config['cloudrun']) ===
                            null || _a === void 0
                            ? void 0
                            : _a['name']
                    ) {
                        defaultName = config['cloudrun']['name']
                    } else {
                        const { shortName } = yield (0, utils_2.getPackageJsonName)(
                            path_1.default.join(targetDir, 'package.json')
                        )
                        if (shortName) {
                            defaultName = shortName
                        } else {
                            defaultName = path_1.default.basename(targetDir)
                        }
                    }
                }
                serviceName = yield _inputServiceName(defaultName)
            }
            if (!targetPath) {
                targetPath = yield _inputTargetPath(
                    maybeInProject ? targetDir : path_1.default.resolve(targetDir, serviceName)
                )
                targetDir = path_1.default.resolve(targetPath)
            }
            const needTips = !force && !(yield (0, utils_2.isDirectoryEmptyOrNotExists)(targetDir))
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
                    log.info('用户已取消下载操作')
                    return
                }
            }
            try {
                yield cloudrunService.download({
                    serverName: serviceName,
                    targetPath: targetDir
                })
                yield (0, utils_2.upsertCloudbaserc)(targetDir, {
                    envId,
                    cloudrun: { name: serviceName }
                })
                log.success(`云托管服务 ${serviceName} 代码已成功下载到: ${targetDir}`)
            } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e))
                ;(0, utils_2.trackCallback)(
                    {
                        type: 'error',
                        details: error.message,
                        originalError: error
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
        __metadata('design:paramtypes', [Object, String, decorators_1.Logger, Object]),
        __metadata('design:returntype', Promise)
    ],
    CloudRunDownloadCommand.prototype,
    'execute',
    null
)
CloudRunDownloadCommand = __decorate([(0, common_1.ICommand)()], CloudRunDownloadCommand)
exports.CloudRunDownloadCommand = CloudRunDownloadCommand
let CloudRunDeleteCommand = class CloudRunDeleteCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'cloudrun',
            childCmd: 'delete',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 ID'
                },
                {
                    flags: '-s, --serviceName <serviceName>',
                    desc: '服务名称',
                    required: true
                },
                {
                    flags: '--force',
                    desc: '强制删除，不提示确认',
                    defaultValue: false
                }
            ],
            requiredEnvId: false,
            autoRunLogin: true,
            desc: '删除云托管服务'
        }
    }
    execute(ctx, envId, log, options) {
        var _a
        return __awaiter(this, void 0, void 0, function* () {
            let { serviceName, force } = options
            if (!envId) {
                envId = yield _selectEnv()
            }
            log.info(`当前环境：${envId}`)
            const cloudrunService = yield getCloudrunService(envId)
            if (!serviceName) {
                const config = yield (0, utils_2.getCloudbaserc)(process.cwd())
                let detaultName = ''
                if (
                    (_a = config === null || config === void 0 ? void 0 : config['cloudrun']) ===
                        null || _a === void 0
                        ? void 0
                        : _a['name']
                ) {
                    detaultName = config['cloudrun']['name']
                }
                serviceName = yield _inputServiceName(detaultName)
            }
            if (!force) {
                const answers = yield inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: `确定要删除云托管服务 ${serviceName} 吗？`,
                        default: false
                    }
                ])
                if (!answers.confirm) {
                    log.info('已取消删除操作')
                    return
                }
            }
            try {
                yield cloudrunService.delete({
                    serverName: serviceName
                })
                log.success(`云托管服务 ${serviceName} 删除成功`)
            } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e))
                ;(0, utils_2.trackCallback)(
                    {
                        type: 'error',
                        details: error.message,
                        originalError: error
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
        __metadata('design:paramtypes', [Object, String, decorators_1.Logger, Object]),
        __metadata('design:returntype', Promise)
    ],
    CloudRunDeleteCommand.prototype,
    'execute',
    null
)
CloudRunDeleteCommand = __decorate([(0, common_1.ICommand)()], CloudRunDeleteCommand)
exports.CloudRunDeleteCommand = CloudRunDeleteCommand
let CloudRunDeployCommand = class CloudRunDeployCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'cloudrun',
            childCmd: 'deploy',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 ID'
                },
                {
                    flags: '-s, --serviceName <serviceName>',
                    desc: '服务名称'
                },
                {
                    flags: '--port <port>',
                    desc: '容器型云托管服务端口（函数型云托管设置无效）'
                },
                {
                    flags: '--source <source>',
                    desc: '部署代码所在目录路径（绝对路径或相对路径，默认: 当前目录）'
                },
                {
                    flags: '--createAgent',
                    desc: '创建函数型 Agent'
                },
                {
                    flags: '--force',
                    desc: '强制部署，跳过所有确认提示',
                    defaultValue: false
                }
            ],
            requiredEnvId: false,
            autoRunLogin: true,
            desc: '部署云托管服务'
        }
    }
    execute(ctx, envId, log, options) {
        var _a, _b
        return __awaiter(this, void 0, void 0, function* () {
            let { serviceName, source, force, port, createAgent } = options
            const targetDir = path_1.default.resolve(source || process.cwd())
            if (!envId) {
                const envConfig = (0, camelcase_keys_1.default)(
                    yield iac_core_1.utils.loadEnv(targetDir)
                )
                if (envConfig === null || envConfig === void 0 ? void 0 : envConfig.envId) {
                    envId = envConfig.envId
                } else {
                    envId = yield _selectEnv()
                }
            }
            log.info(`当前环境 Id：${envId}`)
            if (createAgent) {
                const questions = [
                    {
                        type: 'input',
                        name: 'Name',
                        message: '请输入函数式 Agent 名称:',
                        validate: (input) => {
                            if (!input.trim()) {
                                return '名称不能为空'
                            }
                            return true
                        }
                    },
                    {
                        type: 'input',
                        name: 'BotId',
                        message: '请输入括号内的标识 ibot-(服务名-BotTag)。示例：agent-chat:',
                        validate: (input) => {
                            if (!/^[a-z0-9_]+-[a-z0-9_]+$/.test(input)) {
                                return '标识格式错误，应为"xxx-xxx"'
                            }
                            return true
                        }
                    }
                ]
                const { Name, BotId } = yield inquirer_1.default.prompt(questions)
                const botId = `ibot-${BotId}`
                const agentService = yield getAgentService(envId)
                yield agentService.createFunctionAgent(source, {
                    Name: Name,
                    BotId: botId
                })
                ;(0, utils_2.trackCallback)(
                    {
                        details: `请打开链接查看部署状态: https://tcb.cloud.tencent.com/dev?envId=${envId}#/ai?tab=agent&agent=${botId}`
                    },
                    log
                )
                return
            }
            if (!serviceName) {
                let defaultName = ''
                const config = yield (0, utils_2.getCloudbaserc)(targetDir)
                if (
                    (_a = config === null || config === void 0 ? void 0 : config['cloudrun']) ===
                        null || _a === void 0
                        ? void 0
                        : _a['name']
                ) {
                    defaultName = config['cloudrun']['name']
                } else {
                    const { shortName } = yield (0, utils_2.getPackageJsonName)(
                        path_1.default.join(targetDir, 'package.json')
                    )
                    defaultName = shortName
                }
                serviceName = yield _inputServiceName(defaultName)
            }
            const containerConfigFile = 'container.config.json'
            const containerConfigPath = path_1.default.join(targetDir, containerConfigFile)
            if (yield fs_extra_1.default.pathExists(containerConfigPath)) {
                log.warn(`CLI 中 ${containerConfigFile} 文件将不会生效，请通过命令行参数进行配置！`)
            }
            if (!force) {
                const answers = yield inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: '即将开始部署，是否确认继续？',
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
                    return (0, utils_2.getCredential)(ctx, options)
                },
                polyRepoMode: true
            })
            const cloudrunService = yield getCloudrunService(envId)
            let serverType
            try {
                const details = yield cloudrunService.detail({ serverName: serviceName })
                serverType =
                    (_b = details.BaseInfo) === null || _b === void 0 ? void 0 : _b.ServerType
            } catch (e) {
                const dockerfilePath = path_1.default.join(targetDir, 'Dockerfile')
                if (yield fs_extra_1.default.pathExists(dockerfilePath)) {
                    serverType = 'container'
                } else {
                    serverType = 'function'
                }
            }
            if (!serverType) {
                throw new Error('无法判断云托管服务类型')
            }
            if (!['container', 'function'].includes(serverType)) {
                throw new Error(`不支持的云托管服务类型：${serverType}`)
            }
            yield _runDeploy()
            function _runDeploy() {
                return __awaiter(this, void 0, void 0, function* () {
                    try {
                        utils_2.trackCallback === null || utils_2.trackCallback === void 0
                            ? void 0
                            : (0, utils_2.trackCallback)(
                                  {
                                      details: `正在提交${ResourceTitle[serverType]} ${serviceName} 中，请稍候...`,
                                      status: 'progress'
                                  },
                                  log
                              )
                        yield cloudrunService.deploy({
                            serverName: serviceName,
                            targetPath: targetDir,
                            serverConfig: Object.assign({}, port ? { Port: Number(port) } : {})
                        })
                        utils_2.trackCallback === null || utils_2.trackCallback === void 0
                            ? void 0
                            : (0, utils_2.trackCallback)(
                                  {
                                      details: `提交${ResourceTitle[serverType]} ${serviceName} 已完成！`,
                                      status: 'done'
                                  },
                                  log
                              )
                        yield (0, utils_2.upsertCloudbaserc)(targetDir, {
                            envId,
                            cloudrun: { name: serviceName }
                        })
                        ;(0, utils_2.trackCallback)(
                            {
                                details: `请打开链接查看部署状态: https://tcb.cloud.tencent.com/dev?envId=${envId}#/platform-run/service/detail?serverName=${serviceName}&tabId=deploy&envId=${envId}`
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
                                        message:
                                            '平台当前有部署发布任务正在运行中。确认继续部署，正在执行的部署任务将被取消，并立即部署最新的代码',
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
                                                const error =
                                                    e instanceof Error ? e : new Error(String(e))
                                                ;(0, utils_2.trackCallback)(
                                                    {
                                                        type: 'error',
                                                        details: error.message,
                                                        originalError: error
                                                    },
                                                    log
                                                )
                                            }
                                        }
                                    })
                                )
                        } else {
                            ;(0, utils_2.trackCallback)(
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
        __metadata('design:paramtypes', [Object, String, decorators_1.Logger, Object]),
        __metadata('design:returntype', Promise)
    ],
    CloudRunDeployCommand.prototype,
    'execute',
    null
)
CloudRunDeployCommand = __decorate([(0, common_1.ICommand)()], CloudRunDeployCommand)
exports.CloudRunDeployCommand = CloudRunDeployCommand
let CloudRunRunCommand = class CloudRunRunCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'cloudrun',
            childCmd: 'run',
            allowUnknownOption: true,
            options: [
                {
                    flags: '--runMode <runMode>',
                    desc: '运行模式，可选值: normal(普通函数) | agent(函数式 Agent)，默认值: normal'
                },
                {
                    flags: '--agentId <agentId>',
                    desc: '在 agent 模式下需要提供 Agent ID 进行调试'
                },
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 ID'
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
                    flags: '--extendedContext <extendedContext>',
                    desc: `用于解析 context.extendedContext 的值。""表示该功能已关闭。默认值为 null
                                             示例：--extendedContext '{"a":1,"b":2}'
                                             环境变量：EXTENDED_CONTEXT
                                             `
                },
                {
                    flags: '--open-debug-panel <openDebugPanel>',
                    desc: "是否打开调试面板，默认为 'true'"
                }
            ],
            requiredEnvId: false,
            desc: '本地运行函数型云托管服务（不支持容器型云托管服务）'
        }
    }
    execute(envId, logger, ctx, options) {
        return __awaiter(this, void 0, void 0, function* () {
            debugger
            let { runMode = 'normal', agentId, openDebugPanel = true } = options
            const type = runMode
            console.log(chalk_1.default.green(`当前运行模式: ${type}`))
            if (!process.argv.some((arg) => arg.includes('--dotEnvFilePath='))) {
                process.argv.push('--dotEnvFilePath=.env.local')
            }
            const args = process.argv.slice(2)
            const watchFlag = ['--watch', '-w']
            const defaultIgnoreFiles = ['logs/*.*']
            if (!envId) {
                const envConfig = (0, camelcase_keys_1.default)(
                    yield iac_core_1.utils.loadEnv(process.cwd())
                )
                if (envConfig === null || envConfig === void 0 ? void 0 : envConfig.envId) {
                    envId = envConfig.envId
                } else {
                    envId = yield _selectEnv()
                }
            }
            logger.info(`当前环境 Id：${envId}`)
            if (type === 'agent') {
                if (!agentId) {
                    const answers = yield inquirer_1.default.prompt([
                        {
                            type: 'input',
                            name: 'agentId',
                            message: '请输入 Agent ID（如没有请填写任意值）:',
                            validate: (val) => {
                                return val.trim() ? true : 'Agent ID 不能为空'
                            }
                        }
                    ])
                    agentId = answers.agentId
                }
                logger.info(`当前 Agent ID: ${agentId}`)
            }
            const credential = yield (0, utils_2.getCredential)(ctx, options)
            process.env.EXTENDED_CONTEXT = JSON.stringify({
                tmpSecret: {
                    secretId: credential.secretId,
                    secretKey: credential.secretKey,
                    token: credential.token
                },
                source: 'local_dev',
                envId,
                accessToken: `Bearer ${yield (0, utils_2.fetchAccessToken)({
                    envId,
                    secretId: credential.secretId,
                    secretKey: credential.secretKey,
                    token: credential.token
                })}`
            })
            process.env.STATIC_SERVE_ROOT = __dirname
            process.env.ENABLE_CORS = 'true'
            process.env.ALLOWED_ORIGINS = '*'
            const port = options.port || process.env.PORT || 3000
            if (watchFlag.some((flag) => args.includes(flag))) {
                const cmd = args.filter((arg) => !watchFlag.includes(arg)).join(' ')
                const nodemonInstance = nodemon({
                    script: '',
                    exec: `${process.argv[1]} ${cmd} --envId=${envId} --runMode=${type} --agentId=${agentId}`,
                    watchOptions: {
                        usePolling: true,
                        ignorePermissionErrors: true,
                        ignored: defaultIgnoreFiles.join(','),
                        persistent: true,
                        interval: 500
                    },
                    env: {
                        FROM_NODEMON: 'true'
                    },
                    ext: 'js,mjs,cjs,json,ts,yaml,yml'
                })
                    .on('start', () =>
                        __awaiter(this, void 0, void 0, function* () {
                            logger.info(
                                'Initializing server in watch mode. Changes in source files will trigger a restart.'
                            )
                            if (!process.env.NODEMON_FIRST_START) {
                                process.env.NODEMON_FIRST_START = 'true'
                                this.checkAndRunTsc()
                                this.openDebugApp(
                                    type,
                                    port,
                                    envId,
                                    agentId,
                                    openDebugPanel !== 'false'
                                )
                            }
                        })
                    )
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
                        logger.error('Server crashed.')
                        process.exit(1)
                    })
                    .on('exit', (e) => {
                        logger.info(`Server exited with code ${e}.`)
                    })
            } else {
                ;(0, functions_framework_1.runCLI)()
                if (!process.env.FROM_NODEMON) {
                    this.checkAndRunTsc()
                    if (openDebugPanel) {
                        this.openDebugApp(type, port, envId, agentId, openDebugPanel !== 'false')
                    }
                }
            }
        })
    }
    checkAndRunTsc() {
        var _a
        return __awaiter(this, void 0, void 0, function* () {
            const tsConfigPath = path_1.default.join(process.cwd(), 'tsconfig.json')
            if (yield fs_extra_1.default.exists(tsConfigPath)) {
                const child = (0, execa_1.default)('npx', ['tsc', '-w'], {
                    cwd: process.cwd(),
                    stdio: 'pipe'
                })
                ;(_a = child.stderr) === null || _a === void 0
                    ? void 0
                    : _a.on('data', (data) => {
                          console.log(data.toString())
                      })
                child.on('exit', (code) => {
                    console.log(`子进程退出，退出码 ${code}`)
                })
            }
        })
    }
    openDebugApp(type, port, envId, agentId, isOpen = true) {
        return __awaiter(this, void 0, void 0, function* () {
            let url = `http://127.0.0.1:${port}/cloudrun-run-ui/index.html?type=${type}&envId=${envId}&port=${port}`
            if (type === 'agent') {
                url += `&agentId=${agentId}`
                console.log(chalk_1.default.green(`点击 [${url}] 可以打开 Agent 调试应用`))
            } else {
                console.log(chalk_1.default.green(`点击 [${url}] 可以打开函数调试面板`))
            }
            if (isOpen) {
                yield this.waitForPort(url)
                ;(0, open_1.default)(url, { wait: false })
            }
        })
    }
    waitForPort(url, timeout = 10000) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now()
            const { default: fetch } = yield Promise.resolve().then(() =>
                __importStar(require('node-fetch'))
            )
            while (Date.now() - startTime < timeout) {
                try {
                    const response = yield fetch(url, {
                        timeout: 1000,
                        method: 'HEAD'
                    })
                    if (response.ok) {
                        return
                    }
                } catch (e) {}
                yield new Promise((resolve) => setTimeout(resolve, 500))
            }
            throw new Error(`等待服务${url}就绪超时`)
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.EnvId)()),
        __param(1, (0, decorators_1.Log)()),
        __param(2, (0, decorators_1.CmdContext)()),
        __param(3, (0, decorators_1.ArgsOptions)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [String, decorators_1.Logger, Object, Object]),
        __metadata('design:returntype', Promise)
    ],
    CloudRunRunCommand.prototype,
    'execute',
    null
)
CloudRunRunCommand = __decorate([(0, common_1.ICommand)()], CloudRunRunCommand)
exports.CloudRunRunCommand = CloudRunRunCommand
function _selectEnv() {
    return __awaiter(this, void 0, void 0, function* () {
        return (0, utils_2.selectEnv)({
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
function _inputTargetPath(defaultVal = process.cwd()) {
    return __awaiter(this, void 0, void 0, function* () {
        const questions = [
            {
                type: 'input',
                name: 'targetPath',
                message: '请输入目标路径(目录名称或绝对路径)',
                default: defaultVal,
                validate: (val) => {
                    try {
                        path_1.default.resolve(val)
                        return true
                    } catch (e) {
                        return '请输入有效的路径'
                    }
                },
                filter: (val) => {
                    return path_1.default.normalize(val)
                }
            }
        ]
        const answers = yield inquirer_1.default.prompt(questions)
        return answers['targetPath']
    })
}
