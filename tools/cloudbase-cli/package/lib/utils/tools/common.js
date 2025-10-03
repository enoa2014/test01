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
exports.downloadAndExtractRemoteZip = void 0
const toolbox_1 = require('@cloudbase/toolbox')
const path_1 = __importDefault(require('path'))
const fs_extra_1 = __importDefault(require('fs-extra'))
const unzipper_1 = __importDefault(require('unzipper'))
function downloadAndExtractRemoteZip(downloadUrl, targetPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const downloadResponse = yield (0, toolbox_1.fetchStream)(downloadUrl)
        if (!downloadResponse.ok) {
            throw new Error(`下载失败，状态码: ${downloadResponse.status}`)
        }
        if (!downloadResponse.body) {
            throw new Error('下载响应中没有数据流')
        }
        const dirPath = path_1.default.resolve(targetPath)
        yield fs_extra_1.default.ensureDir(dirPath)
        yield new Promise((resolve, reject) => {
            let totalEntries = 0
            let processedEntries = 0
            downloadResponse.body
                .pipe(unzipper_1.default.Parse())
                .on('error', reject)
                .on('entry', (entry) =>
                    __awaiter(this, void 0, void 0, function* () {
                        const filePath = path_1.default.join(dirPath, entry.path)
                        totalEntries++
                        try {
                            yield fs_extra_1.default.ensureDir(path_1.default.dirname(filePath))
                            if (entry.type === 'Directory') {
                                yield fs_extra_1.default.ensureDir(filePath)
                                processedEntries++
                            } else {
                                entry
                                    .pipe(fs_extra_1.default.createWriteStream(filePath))
                                    .on('error', reject)
                                    .on('finish', () => {
                                        processedEntries++
                                    })
                            }
                        } catch (err) {
                            reject(err)
                        }
                    })
                )
                .on('close', () => {
                    const checkProcessed = () => {
                        if (processedEntries === totalEntries) {
                            resolve('')
                        } else {
                            setTimeout(checkProcessed, 10)
                        }
                    }
                    checkProcessed()
                })
        })
    })
}
exports.downloadAndExtractRemoteZip = downloadAndExtractRemoteZip
