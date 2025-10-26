'use strict'
var __decorate =
    (this && this.__decorate) ||
    function (decorators, target, key, desc) {
        var c = arguments.length,
            r =
                c < 3
                    ? target
                    : desc === null
                      ? (desc = Object.getOwnPropertyDescriptor(target, key))
                      : desc,
            d
        if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function')
            r = Reflect.decorate(decorators, target, key, desc)
        else
            for (var i = decorators.length - 1; i >= 0; i--)
                if ((d = decorators[i]))
                    r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r
        return (c > 3 && r && Object.defineProperty(target, key, r), r)
    }
var __metadata =
    (this && this.__metadata) ||
    function (k, v) {
        if (typeof Reflect === 'object' && typeof Reflect.metadata === 'function')
            return Reflect.metadata(k, v)
    }
var __param =
    (this && this.__param) ||
    function (paramIndex, decorator) {
        return function (target, key) {
            decorator(target, key, paramIndex)
        }
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
Object.defineProperty(exports, '__esModule', { value: true })
exports.DownLoadImage = void 0
const child_process_1 = require('child_process')
const common_1 = require('../../common')
const error_1 = require('../../../error')
const run_1 = require('../../../run')
const utils_1 = require('../../../utils')
const decorators_1 = require('../../../decorators')
const common_2 = require('./common')
let DownLoadImage = class DownLoadImage extends common_1.Command {
    get options() {
        return Object.assign(Object.assign({}, (0, common_2.imageCommonOptions)('download')), {
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                },
                {
                    flags: '-s, --serviceName <serviceName>',
                    desc: '托管服务 name'
                },
                {
                    flags: '-t, --imageTag <imageTag>',
                    desc: '镜像 tag'
                }
            ],
            desc: '删除云开发环境下云托管服务的版本'
        })
    }
    execute(envId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let envCheckType = yield (0, utils_1.checkTcbrEnv)(options.envId, false)
            if (envCheckType !== 0) {
                ;(0, utils_1.logEnvCheck)(envId, envCheckType)
                return
            }
            let { serviceName = '', imageTag = '' } = options
            if (serviceName.length === 0 || imageTag.length === 0) {
                throw new error_1.CloudBaseError('必须输入 serviceName 和 imageTag')
            }
            const loading = (0, utils_1.loadingFactory)()
            const imageRepo = yield (0, run_1.describeImageRepo)({ envId, serverName: serviceName })
            const imageUrl = `ccr.ccs.tencentyun.com/${imageRepo}:${imageTag}`
            if (!(yield (0, run_1.getAuthFlag)())) {
                throw new error_1.CloudBaseError(
                    '无法找到~/.docker/config.json或未登录，需要执行docker login'
                )
            }
            let sh = new Promise((resolve, reject) => {
                ;(0, child_process_1.exec)(`docker pull ${imageUrl}`, (err, stdout) =>
                    err ? reject(err) : resolve({ code: 0, info: stdout })
                ).stdout.pipe(process.stdout)
            })
            yield sh
            loading.succeed('拉取成功')
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.EnvId)()),
        __param(1, (0, decorators_1.ArgsOptions)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object, Object]),
        __metadata('design:returntype', Promise)
    ],
    DownLoadImage.prototype,
    'execute',
    null
)
DownLoadImage = __decorate([(0, common_1.ICommand)()], DownLoadImage)
exports.DownLoadImage = DownLoadImage
