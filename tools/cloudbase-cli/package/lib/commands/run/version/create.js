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
exports.CreateVersion = void 0
const fs_1 = require('fs')
const toolbox_1 = require('@cloudbase/toolbox')
const common_1 = require('../../common')
const error_1 = require('../../../error')
const run_1 = require('../../../run')
const utils_1 = require('../../../utils')
const decorators_1 = require('../../../decorators')
const common_2 = require('./common')
const uploadTypeMap = {
    本地代码: 'package',
    代码库拉取: 'repository',
    镜像拉取: 'image'
}
const memMap = {
    0.25: [2, 8],
    0.5: [2, 8],
    1: [1, 8],
    2: [2, 8],
    4: [2, 8],
    8: [2, 4],
    16: [2, 4]
}
let CreateVersion = class CreateVersion extends common_1.Command {
    get options() {
        return Object.assign(Object.assign({}, (0, common_2.versionCommonOptions)('create')), {
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                },
                {
                    flags: '-s, --serviceName <serviceName>',
                    desc: '托管服务 name'
                },
                {
                    flags: '-p, --path <path>',
                    desc: '本地代码路径，选择本地代码上传时使用'
                },
                {
                    flags: '--repo <repo>',
                    desc: '仓库信息，形如 channel|fullName|branch，channel为github、gitlab或gitee，选择代码库拉取时使用'
                },
                {
                    flags: '-i, --image <image>',
                    desc: '镜像url，选择镜像拉取时使用'
                },
                {
                    flags: '--port <port>',
                    desc: '监听端口，默认为80'
                },
                {
                    flags: '-f, --flow <flow>',
                    desc: '流量策略（%），0或100，默认为0'
                },
                {
                    flags: '-m, --remark <remark>',
                    desc: '备注信息，默认为空'
                },
                {
                    flags: '-c, --cpu <cpu>',
                    desc: 'cpu规格（核数），默认为0.5'
                },
                {
                    flags: '--mem <mem>',
                    desc: '内存规格（G），默认为1'
                },
                {
                    flags: '--copy <copy>',
                    desc: '副本个数，格式为最小个数~最大个数，默认为0~50'
                },
                {
                    flags: '--policy <policy>',
                    desc: '扩缩容条件，格式为条件类型|条件比例（%），cpu条件为cpu，内存为条件mem，默认为cpu|60'
                },
                {
                    flags: '--dockerFile <dockerFile>',
                    desc: 'dockerfile名称，非镜像拉取时使用，默认为Dockerfile'
                },
                {
                    flags: '-l, --log <log>',
                    desc: '日志采集路径，默认为stdout'
                },
                {
                    flags: '-d, --delay <delay>',
                    desc: '初始延迟时间（秒），默认为2'
                },
                {
                    flags: '--env <env>',
                    desc: '环境变量，格式为xx=a&yy=b，默认为空'
                }
            ],
            desc: '创建云开发环境下云托管服务的版本'
        })
    }
    execute(envId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let envCheckType = yield (0, utils_1.checkTcbrEnv)(options.envId, false)
            if (envCheckType !== 0) {
                ;(0, utils_1.logEnvCheck)(envId, envCheckType)
                return
            }
            let {
                serviceName = '',
                path: _path = '',
                repo: _repo = '',
                image: _image = '',
                port: _port = '80',
                flow: _flow = '0',
                remark: _remark = '',
                cpu: _cpu = '0.5',
                mem: _mem = '1',
                copy: _copy = '0~50',
                policy: _policy = 'cpu|60',
                dockerfile: _dockerfile = 'Dockerfile',
                log: _log = 'stdout',
                delay: _delay = '2',
                env: _env = ''
            } = options
            if (!serviceName) {
                throw new error_1.CloudBaseError('必须输入 serviceName')
            }
            let path
            let repositoryType
            let branch
            let codeDetail
            let imageInfo
            let containerPort
            let flowRatio
            let versionRemark
            let cpu
            let mem
            let minNum
            let maxNum
            let policyType
            let policyThreshold
            let customLogs = 'stdout'
            let dockerfilePath = 'Dockerfile'
            let initialDelaySeconds = 2
            let envParams = '{}'
            const uid = (0, utils_1.random)(4)
            const loading = (0, utils_1.loadingFactory)()
            if (_path) {
                path = _path
                if ((0, fs_1.statSync)(path).isDirectory()) {
                    loading.start('正在压缩中')
                    yield (0, toolbox_1.zipDir)(path, `./code${uid}.zip`)
                    loading.succeed('压缩完成')
                    path = `./code${uid}.zip`
                }
            } else if (_repo) {
                const repo = _repo.split('|')
                repositoryType = repo[0]
                codeDetail.Name.FullName = repo[1]
                codeDetail.Name.Name = repo[1].split('/')[1]
                branch = repo[2]
            } else if (_image) {
                imageInfo = {
                    ImageUrl: _image
                }
            } else {
                throw new error_1.CloudBaseError('请至少选择一个上传方式')
            }
            containerPort = Number(_port)
            if (isNaN(containerPort)) {
                throw new error_1.CloudBaseError('请输入合法的端口号')
            }
            flowRatio = Number(_flow)
            if (![100, 0].includes(flowRatio)) {
                throw new error_1.CloudBaseError('请输入合法的流量策略')
            }
            versionRemark = _remark
            cpu = Number(_cpu)
            mem = Number(_mem)
            if (isNaN(cpu) || isNaN(mem)) {
                throw new error_1.CloudBaseError('请输入合法的cpu和内存规格')
            }
            minNum = Number(_copy.split('~')[0])
            maxNum = Number(_copy.split('~')[1])
            if (isNaN(maxNum) || isNaN(minNum)) {
                throw new error_1.CloudBaseError('请输入合法的副本个数')
            }
            policyType = _policy.split('|')[0]
            policyThreshold = Number(_policy.split('|')[1])
            if (!['cpu', 'mem'].includes(policyType) || isNaN(policyThreshold)) {
                throw new error_1.CloudBaseError('请输入合法的扩缩容条件')
            }
            dockerfilePath = _dockerfile
            customLogs = _log
            initialDelaySeconds = Number(_delay)
            if (isNaN(initialDelaySeconds)) {
                throw new error_1.CloudBaseError('请输入合法的延迟时间')
            }
            let _envParams = {}
            _env.split('&').forEach((item) => {
                _envParams[item.split('=')[0]] = item.split('=')[1]
            })
            envParams = JSON.stringify(_envParams)
            loading.start('加载中...')
            let res = ''
            let runId = ''
            if (_path) {
                loading.start('正在上传中')
                let { PackageName, PackageVersion, UploadHeaders, UploadUrl } = yield (0,
                run_1.createBuild)({
                    envId,
                    serviceName
                })
                yield (0, run_1.uploadZip)(path, UploadUrl, UploadHeaders[0])
                loading.succeed('上传成功')
                if (path === `./code${uid}.zip`) {
                    loading.start('删除本地压缩包')
                    ;(0, fs_1.unlinkSync)(path)
                    loading.succeed('成功删除本地压缩包')
                }
                let response = yield (0, run_1.createVersion)({
                    envId,
                    serverName: serviceName,
                    containerPort,
                    uploadType: 'package',
                    packageName: PackageName,
                    packageVersion: PackageVersion,
                    flowRatio,
                    versionRemark,
                    enableUnion: true,
                    cpu,
                    mem,
                    minNum,
                    maxNum,
                    policyType,
                    policyThreshold,
                    customLogs,
                    dockerfilePath,
                    envParams,
                    initialDelaySeconds
                })
                res = response.Result
                runId = response.RunId
            } else if (_image) {
                let response = yield (0, run_1.createVersion)({
                    envId,
                    serverName: serviceName,
                    containerPort,
                    uploadType: 'image',
                    imageInfo,
                    flowRatio,
                    versionRemark,
                    enableUnion: true,
                    cpu,
                    mem,
                    minNum,
                    maxNum,
                    policyType,
                    policyThreshold,
                    customLogs,
                    envParams,
                    initialDelaySeconds
                })
                res = response.Result
                runId = response.RunId
            } else {
                let response = yield (0, run_1.createVersion)({
                    envId,
                    serverName: serviceName,
                    containerPort,
                    uploadType: 'repository',
                    repositoryType,
                    branch,
                    codeDetail,
                    flowRatio,
                    versionRemark,
                    enableUnion: true,
                    cpu,
                    mem,
                    minNum,
                    maxNum,
                    policyType,
                    policyThreshold,
                    customLogs,
                    dockerfilePath,
                    envParams,
                    initialDelaySeconds
                })
                res = response.Result
                runId = response.RunId
            }
            if (res !== 'succ') throw new error_1.CloudBaseError('提交构建任务失败')
            loading.start('正在部署中')
            while (true) {
                let { Percent, Status } = yield (0, run_1.basicOperate)({ envId, runId })
                if (Status === 'build_fail') {
                    let logs = yield (0, run_1.logCreate)({ envId, runId })
                    ;(0, fs_1.writeFileSync)(
                        `./log${runId}`,
                        logs.reduce((res, item) => res + item + '\n', '')
                    )
                    throw new error_1.CloudBaseError(`构建失败，日志写入./log${runId}中`)
                } else if (Status !== 'creating') {
                    break
                }
                loading.start(`目前构建进度${Percent}%`)
                yield new Promise((resolve) => {
                    setTimeout((_) => resolve('again'), 2000)
                })
            }
            loading.succeed('构建成功')
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.EnvId)()),
        __param(1, (0, decorators_1.ArgsOptions)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object, Object]),
        __metadata('design:returntype', Promise)
    ],
    CreateVersion.prototype,
    'execute',
    null
)
CreateVersion = __decorate([(0, common_1.ICommand)()], CreateVersion)
exports.CreateVersion = CreateVersion
