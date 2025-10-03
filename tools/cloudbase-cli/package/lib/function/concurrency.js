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
exports.deleteProvisionedConcurrencyConfig =
    exports.getProvisionedConcurrencyConfig =
    exports.setProvisionedConcurrencyConfig =
        void 0
const error_1 = require('../error')
const base_1 = require('./base')
function setProvisionedConcurrencyConfig(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { envId, functionName, qualifier, versionProvisionedConcurrencyNum } = options
        const scfService = yield (0, base_1.getFunctionService)(envId)
        try {
            yield scfService.setProvisionedConcurrencyConfig({
                functionName,
                qualifier,
                versionProvisionedConcurrencyNum
            })
        } catch (e) {
            throw new error_1.CloudBaseError(
                `[${functionName}] 设置函数预置并发失败： ${e.message}`,
                {
                    code: e.code
                }
            )
        }
    })
}
exports.setProvisionedConcurrencyConfig = setProvisionedConcurrencyConfig
function getProvisionedConcurrencyConfig(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { envId, functionName, qualifier } = options
        const scfService = yield (0, base_1.getFunctionService)(envId)
        try {
            return scfService.getProvisionedConcurrencyConfig({
                functionName,
                qualifier
            })
        } catch (e) {
            throw new error_1.CloudBaseError(
                `[${functionName}] 查看函数预置并发信息失败： ${e.message}`,
                {
                    code: e.code
                }
            )
        }
    })
}
exports.getProvisionedConcurrencyConfig = getProvisionedConcurrencyConfig
function deleteProvisionedConcurrencyConfig(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { envId, functionName, qualifier } = options
        const scfService = yield (0, base_1.getFunctionService)(envId)
        try {
            yield scfService.deleteProvisionedConcurrencyConfig({
                functionName,
                qualifier
            })
        } catch (e) {
            throw new error_1.CloudBaseError(
                `[${functionName}] 删除函数预置并发失败： ${e.message}`,
                {
                    code: e.code
                }
            )
        }
    })
}
exports.deleteProvisionedConcurrencyConfig = deleteProvisionedConcurrencyConfig
