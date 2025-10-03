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
exports.updateCloudRunServerConfig = exports.tcbrServiceConfigOptions = void 0
const toolbox_1 = require('@cloudbase/toolbox')
const common_1 = require('./common')
const utils_1 = require('../../utils')
function tcbrServiceConfigOptions(options) {
    return __awaiter(this, void 0, void 0, function* () {
        let { serviceName, envId, cpu, mem, minNum, maxNum, policyDetails, customLogs, envParams } =
            options
        if (!envId) {
            throw new toolbox_1.CloudBaseError('必须使用 -e 或 --envId 指定环境ID')
        }
        if (!serviceName) {
            throw new toolbox_1.CloudBaseError('必须使用 -s 或 --serviceName 指定服务名')
        }
        let { cpuConverted, memConverted, maxNumConverted, minNumConverted } = (0,
        utils_1.parseOptionalParams)({
            cpu,
            mem,
            maxNum,
            minNum
        })
        const serviceInfo = yield (0, common_1.describeCloudRunServerDetail)({
            envId,
            serviceName
        })
        if (serviceInfo instanceof Error && serviceInfo['code'] === 'InvalidParameter') {
            throw new toolbox_1.CloudBaseError(
                `服务不存在，请检查服务名是否正确或到控制台 ${(0, utils_1.genClickableLink)('https://console.cloud.tencent.com/tcbr')} 创建服务`
            )
        }
        const { ServerConfig: previousServerConfig } = serviceInfo.data
        const newServiceOptions = {
            EnvId: envId,
            ServerName: serviceName,
            OpenAccessTypes: previousServerConfig.OpenAccessTypes,
            Cpu: cpuConverted || previousServerConfig.Cpu,
            Mem: memConverted || previousServerConfig.Mem,
            MinNum: minNumConverted || previousServerConfig.MinNum,
            MaxNum: maxNumConverted || previousServerConfig.MaxNum,
            PolicyDetails: policyDetails
                ? (0, common_1.extractPolicyDetails)(policyDetails)
                : previousServerConfig.PolicyDetails,
            CustomLogs: customLogs || previousServerConfig.CustomLogs,
            EnvParams: envParams
                ? (0, common_1.mergeEnvParams)(
                      envParams,
                      previousServerConfig === null || previousServerConfig === void 0
                          ? void 0
                          : previousServerConfig.EnvParams
                  )
                : previousServerConfig.EnvParams,
            InitialDelaySeconds: 2,
            CreateTime: previousServerConfig.CreateTime,
            Port: previousServerConfig.Port,
            HasDockerfile: true,
            Dockerfile: previousServerConfig.Dockerfile,
            BuildDir: previousServerConfig.BuildDir
        }
        return newServiceOptions
    })
}
exports.tcbrServiceConfigOptions = tcbrServiceConfigOptions
function updateCloudRunServerConfig(options) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield (0, utils_1.callTcbrApi)('UpdateCloudRunServerConfig', {
            EnvId: options.envId,
            ServerBaseConfig: options.ServerBaseConfig
        })
    })
}
exports.updateCloudRunServerConfig = updateCloudRunServerConfig
