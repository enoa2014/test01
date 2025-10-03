'use strict'
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
exports.validateTcrImageURL =
    exports.getAuthorizedTcrInstance =
    exports.tcbrServiceOptions =
    exports.mergeEnvParams =
    exports.parseEnvParams =
    exports.extractPolicyDetails =
    exports.convertNumber =
    exports.describeWxCloudBaseRunReleaseOrder =
    exports.describeCloudRunServerDetail =
        void 0
const utils_1 = require('../../utils')
const types_1 = require('../../types')
const toolbox_1 = require('@cloudbase/toolbox')
const index_1 = require('./index')
const __1 = require('..')
const constant_1 = require('../../constant')
const tcbService = utils_1.CloudApiService.getInstance('tcb')
const tcrCloudApiService = new utils_1.CloudApiService('tcr', {}, '2019-09-24')
const describeCloudRunServerDetail = (options) =>
    __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, utils_1.callTcbrApi)('DescribeCloudRunServerDetail', {
            EnvId: options.envId,
            ServerName: options.serviceName
        })
    })
exports.describeCloudRunServerDetail = describeCloudRunServerDetail
function describeWxCloudBaseRunReleaseOrder(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield tcbService.request('DescribeWxCloudBaseRunReleaseOrder', {
            EnvId: options.envId,
            ServerName: options.serviceName
        })
        return res
    })
}
exports.describeWxCloudBaseRunReleaseOrder = describeWxCloudBaseRunReleaseOrder
const convertNumber = (item) => {
    if (isNaN(Number(item))) {
        throw new toolbox_1.CloudBaseError(`${item} 必须为数字`)
    }
    return Number(item)
}
exports.convertNumber = convertNumber
const extractPolicyDetails = (policyDetails) => {
    return policyDetails.split('&').map((condition) => {
        let [type, threshold] = [condition.split('=')[0], Number(condition.split('=')[1])]
        if (isNaN(threshold) || !['cpu', 'mem'].includes(type)) {
            throw new toolbox_1.CloudBaseError('请输入合法的缩扩容配置')
        }
        return {
            PolicyType: type,
            PolicyThreshold: threshold
        }
    })
}
exports.extractPolicyDetails = extractPolicyDetails
const parseEnvParams = (envParams) => {
    return envParams.split('&').reduce((acc, cur) => {
        const [key, value] = cur.split('=')
        acc[key] = value
        return acc
    }, {})
}
exports.parseEnvParams = parseEnvParams
const mergeEnvParams = (curEnvParams, preEnvParams) => {
    const curEnv = (0, exports.parseEnvParams)(curEnvParams)
    const preEnv = preEnvParams ? JSON.parse(preEnvParams) : {}
    const curEnvKeys = Object.keys(curEnv)
    Object.entries(preEnv).forEach(([key, value]) => {
        if (!curEnvKeys.includes(key)) {
            curEnv[key] = value
        }
    })
    return JSON.stringify(curEnv)
}
exports.mergeEnvParams = mergeEnvParams
function checkRequiredParams(options) {
    if (!options.envId) {
        throw new toolbox_1.CloudBaseError('请使用 -e 或 --envId 指定环境ID')
    }
    if (!options.serviceName) {
        throw new toolbox_1.CloudBaseError('请使用 -s 或 --serviceName 指定服务名')
    }
    if (!options.containerPort) {
        throw new toolbox_1.CloudBaseError('请使用 --containerPort 指定监听端口号')
    }
    if (!options.isCreated && !options.path && !options.custom_image) {
        throw new toolbox_1.CloudBaseError(
            '请使用 --path 指定代码根目录或 --custom_image 指定 TCR 镜像 URL'
        )
    }
    if (
        options.isCreated &&
        !options.path &&
        !options.custom_image &&
        !options.library_image &&
        !options.image
    ) {
        throw new toolbox_1.CloudBaseError(
            '请使用 --path 指定代码根目录或 --custom_image 指定 TCR 镜像 URL 或 --library_image 指定线上镜像 tag '
        )
    }
}
function tcbrServiceOptions(options, isCreated, defaultOverride, previousServerConfig) {
    return __awaiter(this, void 0, void 0, function* () {
        let {
            noConfirm: _noConfirm = false,
            override: _override = defaultOverride || false,
            envId,
            serviceName,
            path,
            cpu,
            mem,
            minNum,
            maxNum,
            policyDetails,
            customLogs,
            envParams,
            containerPort,
            remark,
            targetDir,
            dockerfile,
            image,
            custom_image,
            library_image,
            log_type,
            json: _json = false
        } = options
        checkRequiredParams({
            envId,
            serviceName,
            containerPort,
            isCreated,
            path,
            custom_image,
            library_image,
            image
        })
        containerPort = Number(containerPort)
        const deployByImage = Boolean(custom_image || library_image || image)
        const DeployInfo = {
            DeployType: deployByImage ? types_1.DEPLOY_TYPE.IMAGE : types_1.DEPLOY_TYPE.PACKAGE,
            DeployRemark: remark || '',
            ReleaseType: 'FULL'
        }
        let { cpuConverted, memConverted, maxNumConverted, minNumConverted } = (0,
        utils_1.parseOptionalParams)({
            cpu,
            mem,
            maxNum,
            minNum
        })
        if (log_type && log_type !== 'none') {
            throw new toolbox_1.CloudBaseError(
                '日志类型 log_type 只能为 none，如需自定义日志，请前往控制台配置'
            )
        }
        const defaultLogType = 'none'
        const newServiceOptions = {
            ServerName: serviceName,
            EnvId: envId,
            ServerConfig: {
                EnvId: envId,
                MaxNum: (0, utils_1.parseInputParam)(
                    maxNumConverted,
                    _override,
                    exports.convertNumber,
                    previousServerConfig === null || previousServerConfig === void 0
                        ? void 0
                        : previousServerConfig.MaxNum,
                    50
                ),
                MinNum: (0, utils_1.parseInputParam)(
                    minNumConverted,
                    _override,
                    exports.convertNumber,
                    previousServerConfig === null || previousServerConfig === void 0
                        ? void 0
                        : previousServerConfig.MinNum,
                    0
                ),
                BuildDir: (0, utils_1.parseInputParam)(
                    targetDir,
                    _override,
                    null,
                    previousServerConfig === null || previousServerConfig === void 0
                        ? void 0
                        : previousServerConfig.BuildDir,
                    '.'
                ),
                Cpu: (0, utils_1.parseInputParam)(
                    cpuConverted,
                    _override,
                    null,
                    previousServerConfig === null || previousServerConfig === void 0
                        ? void 0
                        : previousServerConfig.Cpu,
                    0.5
                ),
                Mem: (0, utils_1.parseInputParam)(
                    memConverted,
                    _override,
                    null,
                    previousServerConfig === null || previousServerConfig === void 0
                        ? void 0
                        : previousServerConfig.Mem,
                    1
                ),
                OpenAccessTypes: ['PUBLIC'],
                ServerName: serviceName,
                InitialDelaySeconds: 2,
                CustomLogs: (0, utils_1.parseInputParam)(
                    customLogs,
                    _override,
                    null,
                    previousServerConfig === null || previousServerConfig === void 0
                        ? void 0
                        : previousServerConfig.CustomLogs,
                    'stdout'
                ),
                CreateTime:
                    (previousServerConfig === null || previousServerConfig === void 0
                        ? void 0
                        : previousServerConfig.CreateTime) ||
                    new Date().toLocaleString().replace(/\//g, '-'),
                PolicyDetails: (0, utils_1.parseInputParam)(
                    policyDetails,
                    _override,
                    exports.extractPolicyDetails,
                    previousServerConfig === null || previousServerConfig === void 0
                        ? void 0
                        : previousServerConfig.PolicyDetails,
                    constant_1.DEFAULT_CPU_MEM_SET
                ),
                EnvParams: (0, utils_1.parseInputParam)(
                    envParams,
                    _override,
                    exports.mergeEnvParams,
                    previousServerConfig === null || previousServerConfig === void 0
                        ? void 0
                        : previousServerConfig.EnvParams,
                    '',
                    previousServerConfig === null || previousServerConfig === void 0
                        ? void 0
                        : previousServerConfig.EnvParams
                ),
                Port: containerPort,
                HasDockerfile: true,
                Dockerfile: dockerfile || 'Dockerfile',
                LogType: (0, utils_1.parseInputParam)(
                    log_type,
                    _override,
                    null,
                    previousServerConfig === null || previousServerConfig === void 0
                        ? void 0
                        : previousServerConfig.LogType,
                    defaultLogType
                ),
                LogSetId:
                    previousServerConfig === null || previousServerConfig === void 0
                        ? void 0
                        : previousServerConfig.LogSetId,
                LogTopicId:
                    previousServerConfig === null || previousServerConfig === void 0
                        ? void 0
                        : previousServerConfig.LogTopicId,
                LogParseType:
                    previousServerConfig === null || previousServerConfig === void 0
                        ? void 0
                        : previousServerConfig.LogParseType
            },
            DeployInfo: Object.assign({}, DeployInfo)
        }
        if (DeployInfo.DeployType === types_1.DEPLOY_TYPE.PACKAGE) {
            const { PackageName, PackageVersion } = yield (0, index_1.packageDeploy)({
                envId,
                serviceName,
                filePath: path
            })
            DeployInfo.PackageName = PackageName
            DeployInfo.PackageVersion = PackageVersion
        } else if (DeployInfo.DeployType === types_1.DEPLOY_TYPE.IMAGE) {
            if (custom_image) {
                const authorizedTcrInstances = yield getAuthorizedTcrInstance(envId)
                if (!authorizedTcrInstances) {
                    const link = `https://console.cloud.tencent.com/tcbr/env?/tcbr/env=&envId=${envId}`
                    throw new toolbox_1.CloudBaseError(
                        `您还未授权 tcr 实例，请先到控制台授权：${(0, utils_1.genClickableLink)(link)}`
                    )
                }
                yield validateTcrImageURL(authorizedTcrInstances, custom_image)
                DeployInfo.ImageUrl = custom_image
            } else {
                const imageList = yield (0, __1.listImage)({
                    envId,
                    serviceName
                })
                if (library_image) {
                    const imageInfo = imageList.find(({ Tag }) => Tag === library_image)
                    if (!imageInfo) {
                        throw new toolbox_1.CloudBaseError(`镜像 ${library_image} 不存在`)
                    }
                    DeployInfo.ImageUrl = imageInfo.ImageUrl
                } else {
                    throw new toolbox_1.CloudBaseError(
                        '暂不支持 --image 参数，请使用 --custom_image 指定 tcr 镜像 URL 或 --library_image 指定线上镜像 tag'
                    )
                }
            }
        }
        newServiceOptions.DeployInfo = Object.assign({}, DeployInfo)
        return newServiceOptions
    })
}
exports.tcbrServiceOptions = tcbrServiceOptions
function getAuthorizedTcrInstance(envId) {
    return __awaiter(this, void 0, void 0, function* () {
        let {
            data: { TcrInstances: authorizedTcrInstances }
        } = yield (0, utils_1.callTcbrApi)('DescribeTcrInstances', {
            EnvId: envId
        })
        return authorizedTcrInstances
    })
}
exports.getAuthorizedTcrInstance = getAuthorizedTcrInstance
function validateTcrImageURL(authorizedTcrInstances, imageUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        const errMsg = '镜像URL解析失败，请检查输入的镜像URL是否正确'
        try {
            const host = imageUrl.split('/')[0]
            const namespace = imageUrl.split('/')[1]
            const name = `${namespace}/${imageUrl.split('/')[2].split(':')[0]}`
            const tag = imageUrl.split('/')[2].split(':')[1]
            const filteredInstances =
                authorizedTcrInstances === null || authorizedTcrInstances === void 0
                    ? void 0
                    : authorizedTcrInstances.filter(({ Domain }) => host === Domain)
            if (
                !(filteredInstances === null || filteredInstances === void 0
                    ? void 0
                    : filteredInstances.length)
            ) {
                throw new toolbox_1.CloudBaseError(errMsg)
            }
            const reposUnderSpecifiedRegistry = []
            for (const registry of filteredInstances) {
                const repos = []
                let { Id: registryId, Domain: domain } = registry
                const limit = 100
                let curIndex = 1
                let totalCount = 0
                do {
                    const rsp = yield tcrCloudApiService.request('DescribeRepositories', {
                        RegistryId: registryId,
                        Offset: curIndex,
                        Limit: limit
                    })
                    repos.push(...rsp.RepositoryList)
                    curIndex += 1
                    totalCount = rsp.TotalCount
                } while (repos.length < totalCount)
                reposUnderSpecifiedRegistry.push({ registryId, domain, repos })
            }
            const filteredRepos = []
            for (const repo of reposUnderSpecifiedRegistry) {
                const { registryId, repos } = repo
                filteredRepos.push(...repos.filter(({ Name }) => Name === name))
                if (
                    !(filteredRepos === null || filteredRepos === void 0
                        ? void 0
                        : filteredRepos.length)
                ) {
                    throw new toolbox_1.CloudBaseError(errMsg)
                }
                filteredRepos.forEach((item) => {
                    item.registryId = registryId
                })
            }
            for (const repoItem of filteredRepos) {
                const { Name, Namespace, registryId } = repoItem
                const images = []
                const limit = 100
                let curIndex = 1
                let totalCount = 0
                do {
                    const rsp = yield tcrCloudApiService.request('DescribeImages', {
                        RegistryId: registryId,
                        NamespaceName: Namespace,
                        RepositoryName: Name.split(`${Namespace}/`)[1],
                        Offset: curIndex,
                        Limit: limit
                    })
                    images.push(...rsp.ImageInfoList)
                    curIndex += 1
                    totalCount = rsp.TotalCount
                } while (images.length < totalCount)
                if (!images.some(({ ImageVersion }) => ImageVersion === tag)) {
                    throw new toolbox_1.CloudBaseError(errMsg)
                }
            }
        } catch (e) {
            throw new toolbox_1.CloudBaseError(errMsg)
        }
    })
}
exports.validateTcrImageURL = validateTcrImageURL
