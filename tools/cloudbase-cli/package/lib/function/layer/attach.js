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
exports.unAttachLayer = exports.attachLayer = void 0
const lodash_1 = __importDefault(require('lodash'))
const utils_1 = require('../../utils')
const error_1 = require('../../error')
const __1 = require('../')
const scfService = new utils_1.CloudApiService('scf')
function attachLayer(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { envId, functionName, layerName, layerVersion, codeSecret } = options
        const functionService = yield (0, __1.getFunctionService)(envId)
        let { Layers } = yield functionService.getFunctionDetail(functionName, codeSecret)
        Layers = Layers.map((item) => lodash_1.default.pick(item, ['LayerName', 'LayerVersion']))
        Layers.push({
            LayerName: layerName,
            LayerVersion: layerVersion
        })
        const res = yield scfService.request('UpdateFunctionConfiguration', {
            Layers,
            Namespace: envId,
            FunctionName: functionName
        })
        return res
    })
}
exports.attachLayer = attachLayer
function unAttachLayer(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { envId, functionName, layerName, layerVersion, codeSecret } = options
        const functionService = yield (0, __1.getFunctionService)(envId)
        let { Layers } = yield functionService.getFunctionDetail(functionName, codeSecret)
        Layers = Layers.map((item) => lodash_1.default.pick(item, ['LayerName', 'LayerVersion']))
        const index = Layers.findIndex(
            (item) => item.LayerName === layerName && item.LayerVersion === layerVersion
        )
        if (index === -1) {
            throw new error_1.CloudBaseError('层不存在')
        }
        Layers.splice(index, 1)
        const apiParams = {
            Namespace: envId,
            FunctionName: functionName,
            Layers:
                Layers.length > 0
                    ? Layers
                    : [
                          {
                              LayerName: '',
                              LayerVersion: 0
                          }
                      ]
        }
        return scfService.request('UpdateFunctionConfiguration', apiParams)
    })
}
exports.unAttachLayer = unAttachLayer
