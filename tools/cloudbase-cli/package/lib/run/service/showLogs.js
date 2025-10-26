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
exports.getLogs = exports.getBuildStatus = void 0
const utils_1 = require('../../utils')
const chalk_1 = __importDefault(require('chalk'))
function getBuildStatus(envId, serviceName) {
    return __awaiter(this, void 0, void 0, function* () {
        const { data: deployRes } = yield (0, utils_1.callTcbrApi)('DescribeCloudRunDeployRecord', {
            EnvId: envId,
            ServerName: serviceName
        })
        if (deployRes === null || deployRes === void 0 ? void 0 : deployRes.DeployRecords) {
            if (
                (deployRes === null || deployRes === void 0
                    ? void 0
                    : deployRes.DeployRecords[0].Status) === 'deploying'
            ) {
                return Promise.resolve('pending')
            } else {
                return Promise.resolve('completed')
            }
        } else {
            return Promise.resolve('pending')
        }
    })
}
exports.getBuildStatus = getBuildStatus
function getBuildId(envId, serviceName) {
    return __awaiter(this, void 0, void 0, function* () {
        const { data: deployRes } = yield (0, utils_1.callTcbrApi)('DescribeCloudRunDeployRecord', {
            EnvId: envId,
            ServerName: serviceName
        })
        if (deployRes === null || deployRes === void 0 ? void 0 : deployRes.DeployRecords) {
            if (deployRes.DeployRecords[0].Status !== 'deploying') {
                return Promise.resolve(deployRes.DeployRecords[0].BuildId)
            }
        }
    })
}
function getRunId(envId, serviceName) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve) => {
            const timer = setInterval(
                () =>
                    __awaiter(this, void 0, void 0, function* () {
                        const { data: deployRes } = yield (0, utils_1.callTcbrApi)(
                            'DescribeCloudRunDeployRecord',
                            {
                                EnvId: envId,
                                ServerName: serviceName
                            }
                        )
                        if (
                            deployRes === null || deployRes === void 0
                                ? void 0
                                : deployRes.DeployRecords
                        ) {
                            clearInterval(timer)
                            resolve(deployRes.DeployRecords[0].RunId)
                        }
                    }),
                3000
            )
        })
    })
}
function showProcessLogs(envId, runId, serviceName) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve) => {
            const timer = setInterval(
                () =>
                    __awaiter(this, void 0, void 0, function* () {
                        if ((yield getBuildStatus(envId, serviceName)) === 'completed') {
                            clearInterval(timer)
                            resolve()
                        } else {
                            const { data: processLogs } = yield (0, utils_1.callTcbrApi)(
                                'DescribeCloudRunProcessLog',
                                {
                                    EnvId: envId,
                                    RunId: runId
                                }
                            )
                            if (
                                processLogs === null || processLogs === void 0
                                    ? void 0
                                    : processLogs.Logs
                            ) {
                                console.log(
                                    processLogs === null || processLogs === void 0
                                        ? void 0
                                        : processLogs.Logs.join('\n')
                                )
                            }
                        }
                    }),
                5000
            )
        })
    })
}
function showBuildLogs(envId, serviceName, serverVersion = '', offset = 0) {
    var _a, _b
    return __awaiter(this, void 0, void 0, function* () {
        const buildId = yield getBuildId(envId, serviceName)
        const { data } = yield (0, utils_1.callTcbrApi)('DescribeCloudRunBuildLog', {
            EnvId: envId,
            BuildId: buildId,
            ServerName: serviceName,
            ServerVersion: serverVersion || '',
            Offset: offset || 0
        })
        if (
            (_a = data === null || data === void 0 ? void 0 : data.Log) === null || _a === void 0
                ? void 0
                : _a.Text
        ) {
            console.log(
                (_b = data === null || data === void 0 ? void 0 : data.Log) === null ||
                    _b === void 0
                    ? void 0
                    : _b.Text
            )
        }
        return Promise.resolve()
    })
}
function getLogs(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const runId = yield getRunId(options.envId, options.serviceName)
        console.log(chalk_1.default.blue('============ 日志开始 ==============='))
        yield showProcessLogs(options.envId, runId, options.serviceName)
        if ((yield getBuildStatus(options.envId, options.serviceName)) === 'completed') {
            yield showBuildLogs(options.envId, options.serviceName)
        }
        console.log(chalk_1.default.blue('============ 日志结束 ==============='))
    })
}
exports.getLogs = getLogs
