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
exports.listFunctionVersions = exports.publishVersion = void 0
const error_1 = require('../error')
const base_1 = require('./base')
function publishVersion(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { envId, functionName, description = '' } = options
        const scfService = yield (0, base_1.getFunctionService)(envId)
        try {
            yield scfService.publishVersion({
                functionName,
                description
            })
        } catch (e) {
            throw new error_1.CloudBaseError(
                `[${functionName}] 函数发布新版本失败： ${e.message}`,
                {
                    code: e.code
                }
            )
        }
    })
}
exports.publishVersion = publishVersion
function listFunctionVersions(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { envId, functionName, offset = 0, limit = 20 } = options
        const scfService = yield (0, base_1.getFunctionService)(envId)
        try {
            return scfService.listVersionByFunction({
                functionName,
                offset,
                limit
            })
        } catch (e) {
            throw new error_1.CloudBaseError(
                `[${functionName}] 查看寒函数版本列表失败： ${e.message}`,
                {
                    code: e.code
                }
            )
        }
    })
}
exports.listFunctionVersions = listFunctionVersions
