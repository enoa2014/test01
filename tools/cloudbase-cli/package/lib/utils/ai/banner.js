'use strict'
var __createBinding =
    (this && this.__createBinding) ||
    (Object.create
        ? function (o, m, k, k2) {
              if (k2 === undefined) k2 = k
              var desc = Object.getOwnPropertyDescriptor(m, k)
              if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
                  desc = {
                      enumerable: true,
                      get: function () {
                          return m[k]
                      }
                  }
              }
              Object.defineProperty(o, k2, desc)
          }
        : function (o, m, k, k2) {
              if (k2 === undefined) k2 = k
              o[k2] = m[k]
          })
var __setModuleDefault =
    (this && this.__setModuleDefault) ||
    (Object.create
        ? function (o, v) {
              Object.defineProperty(o, 'default', { enumerable: true, value: v })
          }
        : function (o, v) {
              o['default'] = v
          })
var __importStar =
    (this && this.__importStar) ||
    function (mod) {
        if (mod && mod.__esModule) return mod
        var result = {}
        if (mod != null)
            for (var k in mod)
                if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k))
                    __createBinding(result, mod, k)
        __setModuleDefault(result, mod)
        return result
    }
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
exports.showBanner = void 0
const chalk_1 = __importDefault(require('chalk'))
const output_1 = require('../output')
function showBanner(log) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const figlet = yield Promise.resolve().then(() => __importStar(require('figlet')))
            const data = figlet.textSync(
                `CloudBase
AI ToolKit`,
                {
                    font: 'Slant',
                    horizontalLayout: 'fitted',
                    verticalLayout: 'fitted'
                }
            )
            const supportsColor = process.stdout.isTTY && process.env.TERM !== 'dumb'
            if (supportsColor) {
                try {
                    const gradient = yield Promise.resolve().then(() =>
                        __importStar(require('gradient-string'))
                    )
                    const gradientText = gradient
                        .default(['cyan', 'rgb(0, 111, 150)', 'rgb(0, 246,136)'])
                        .multiline(data)
                    log.log(chalk_1.default.bold(gradientText + '\n'))
                } catch (gradientError) {
                    log.log(chalk_1.default.bold.cyan(data + '\n'))
                }
            } else {
                log.log(data + '\n')
            }
            if (supportsColor) {
                log.log(
                    chalk_1.default.hex('#34495E')(
                        '    🚀 统一集成各种 AI CLI 工具，内置云开发全栈能力'
                    )
                )
                log.log(
                    chalk_1.default.hex('#34495E')(
                        '    ⚡ 生成、部署和托管全栈 Web 应用与小程序、数据库和后端服务'
                    )
                )
                log.log(chalk_1.default.hex('#34495E')('    🎯 无需运维，极速上线你的创意 💫'))
            } else {
                log.log('    🚀 统一集成各种 AI CLI 工具，内置云开发全栈能力')
                log.log('    ⚡ 生成、部署和托管全栈 Web 应用与小程序、数据库和后端服务')
                log.log('    🎯 无需运维，极速上线你的创意 💫')
            }
            log.log('')
            log.log('Github:')
            log.log(
                (0, output_1.genClickableLink)(
                    'https://github.com/TencentCloudBase/CloudBase-AI-ToolKit'
                )
            )
            log.log('')
            log.log('使用指引')
            log.log(
                (0, output_1.genClickableLink)('https://docs.cloudbase.net/cli-v1/ai/introduce')
            )
            log.log('')
        } catch (e) {
            log.log(
                chalk_1.default.bold.cyanBright('⛰︎'),
                chalk_1.default.bold.hex('#FFFFFF')(' CloudBase AI ToolKit CLI')
            )
            log.log(chalk_1.default.bold.cyanBright(''))
            log.log(
                chalk_1.default.hex('#34495E')(
                    '    🚀 统一集成各种 AI CLI 工具，内置云开发全栈能力'
                )
            )
            log.log(
                chalk_1.default.hex('#34495E')(
                    '    ⚡ 生成、部署和托管全栈 Web 应用与小程序、数据库和后端服务'
                )
            )
            log.log(chalk_1.default.hex('#34495E')('    🎯 无需运维，极速上线你的创意 💫'))
            log.log('')
            log.log('Github:')
            log.log(
                (0, output_1.genClickableLink)(
                    'https://github.com/TencentCloudBase/CloudBase-AI-ToolKit'
                )
            )
            log.log('')
            log.log('使用指引')
            log.log(
                (0, output_1.genClickableLink)('https://docs.cloudbase.net/cli-v1/ai/introduce')
            )
            log.log('')
        }
    })
}
exports.showBanner = showBanner
