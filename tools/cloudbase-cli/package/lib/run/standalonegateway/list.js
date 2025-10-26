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
exports.listStandalonegateway = void 0
const error_1 = require('../../error')
const utils_1 = require('../../utils')
const tcbService = utils_1.CloudApiService.getInstance('tcb')
const listStandalonegateway = (options) =>
    __awaiter(void 0, void 0, void 0, function* () {
        const res = yield tcbService.request('DescribeStandaloneGateway', {
            EnvId: options.envId,
            GatewayName: options.gatewayName,
            GatewayAlias: options.gatewayAlias
        })
        const { StandaloneGatewayList } = res
        if (StandaloneGatewayList !== undefined) {
            return StandaloneGatewayList.map((item) => [
                item['GatewayName'],
                item['GateWayStatus'],
                item['GatewayAlias'],
                item['PackageVersion'],
                beautifySubnetList(item['SubnetIds']),
                item['PublicClbIp'],
                item['InternalClbIp'],
                beautifyServiceList(item['ServiceInfo'])
            ])
        } else {
            const {
                Error: { Message }
            } = res
            throw new error_1.CloudBaseError(Message)
        }
    })
exports.listStandalonegateway = listStandalonegateway
const beautifySubnetList = (list) => list.join('\n')
const beautifyServiceList = (list) =>
    list
        .map(
            (item) =>
                '服务 ' + item['ServiceName'] + (item['Status'] === 'on' ? ' 开启' : ' 未开启')
        )
        .join('\n')
