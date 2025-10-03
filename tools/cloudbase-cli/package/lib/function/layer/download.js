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
exports.downloadLayer = void 0
const path_1 = __importDefault(require('path'))
const utils_1 = require('../../utils')
const error_1 = require('../../error')
const common_1 = require('../../utils/tools/common')
const scfService = new utils_1.CloudApiService('scf')
function downloadLayer(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { name, version, destPath } = options
        const res = yield scfService.request('GetLayerVersion', {
            LayerName: name,
            LayerVersion: version
        })
        const url = res === null || res === void 0 ? void 0 : res.Location
        const zipPath = path_1.default.join(destPath, `${name}-${version}.zip`)
        if ((0, utils_1.checkFullAccess)(zipPath)) {
            throw new error_1.CloudBaseError(`文件已存在：${zipPath}`)
        }
        return (0, common_1.downloadAndExtractRemoteZip)(url, destPath)
    })
}
exports.downloadLayer = downloadLayer
