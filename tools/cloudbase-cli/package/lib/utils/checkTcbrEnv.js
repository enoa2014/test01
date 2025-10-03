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
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, '__esModule', { value: true })
exports.logEnvCheck = exports.checkTcbrEnv = void 0
const chalk_1 = __importDefault(require('chalk'))
const error_1 = require('../error')
const tcbrApi_1 = require('./tcbrApi')
const oldCmdSet = `
服务列表：tcb run:deprecated list --envId <envId>
创建服务：tcb run:deprecated create --envId <envId> --name <name>
删除服务：tcb run:deprecated delete --envId <envId> --serviceName <serviceName>

版本列表：tcb run:deprecated version list --envId <envId> --serviceName <serviceName>
创建版本：tcb run:deprecated version create --envId <envId> --serviceName <serviceName>
分配流量：tcb run:deprecated version modify --envId <envId> --serviceName <serviceName>
滚动更新：tcb run:deprecated version update --envId <envId> --serviceName <serviceName> --versionName <versionName>
删除版本：tcb run:deprecated version delete --envId <envId> --serviceName <serviceName> --versionName <versionName>

查看镜像：tcb run:deprecated image list --envId <envId> --serviceName <serviceName>
上传镜像：tcb run:deprecated image upload --envId <envId> --serviceName <serviceName> --imageId <imageId> --imageTag <imageTag>
下载镜像：tcb run:deprecated image download --envId <envId> --serviceName <serviceName> --imageTag <imageTag>
删除镜像：tcb run:deprecated image delete --envId <envId> --serviceName <serviceName> --imageTag <imageTag>
`
const newCmdSet = `
查看环境下服务：tcb run service:list --envId <envId>
创建云托管服务：tcb run service:create --envId <envId> --serviceName <serviceName> --containerPort <containerPort>
更新云托管服务：tcb run service:update --envId <envId> --serviceName <serviceName> --containerPort <containerPort>
部署云托管服务：tcb run deploy --envId <envId> --serviceName <serviceName> --containerPort <containerPort>
更新服务基础配置：tcb run service:config --envId <envId> --serviceName <serviceName>
`
function checkTcbrEnv(envId, isTcbr) {
    return __awaiter(this, void 0, void 0, function* () {
        if (envId === undefined) {
            throw new error_1.CloudBaseError('请使用 -e 或 --envId 指定环境 ID')
        }
        const { data: res } = yield (0, tcbrApi_1.callTcbrApi)('DescribeCloudRunEnvs', {
            EnvId: envId
        })
        const { EnvList } = res
        const envInfo =
            EnvList === null || EnvList === void 0
                ? void 0
                : EnvList.find(
                      (item) => (item === null || item === void 0 ? void 0 : item.EnvId) === envId
                  )
        if (envInfo === undefined) {
            throw new error_1.CloudBaseError(
                `无法读取到有效的环境信息，请检查环境 ID 是否正确\nrequestId: ${res === null || res === void 0 ? void 0 : res.RequestId}`
            )
        }
        if ((envInfo.EnvType === 'tcbr' && isTcbr) || (envInfo.EnvType !== 'tcbr' && !isTcbr)) {
            return 0
        } else if (envInfo.EnvType === 'tcbr' && !isTcbr) {
            return 1
        } else if (envInfo.EnvType !== 'tcbr' && isTcbr) {
            return 2
        }
    })
}
exports.checkTcbrEnv = checkTcbrEnv
function logEnvCheck(envId, warningType) {
    if (warningType === 1) {
        throw new error_1.CloudBaseError(
            `当前能力不支持 ${envId} 环境，请使用如下操作集：${chalk_1.default.grey(newCmdSet)}`
        )
    } else if (warningType === 2) {
        throw new error_1.CloudBaseError(
            `当前能力不支持 ${envId} 环境，请使用如下操作集：${chalk_1.default.grey(oldCmdSet)}`
        )
    }
}
exports.logEnvCheck = logEnvCheck
