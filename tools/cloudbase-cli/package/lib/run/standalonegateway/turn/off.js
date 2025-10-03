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
exports.turnOffStandalonegateway = void 0
const error_1 = require('../../../error')
const utils_1 = require('../../../utils')
const tcbService = utils_1.CloudApiService.getInstance('tcb')
const turnOffStandalonegateway = (options) =>
    __awaiter(void 0, void 0, void 0, function* () {
        const res = yield tcbService.request('TurnOffStandaloneGateway', {
            EnvId: options.envId,
            GatewayName: options.gatewayName,
            ServiceNameList: options.serviceList
        })
        const { Error: Message } = res
        if (Message !== undefined) {
            throw new error_1.CloudBaseError(JSON.stringify(Message))
        }
        return res
    })
exports.turnOffStandalonegateway = turnOffStandalonegateway
