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
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, '__esModule', { value: true })
exports.DownloadFileLayer = void 0
const path_1 = __importDefault(require('path'))
const fs_extra_1 = __importDefault(require('fs-extra'))
const enquirer_1 = require('enquirer')
const utils_1 = require('../../../utils')
const error_1 = require('../../../error')
const common_1 = require('../../common')
const decorators_1 = require('../../../decorators')
const function_1 = require('../../../function')
const common_2 = require('./common')
let DownloadFileLayer = class DownloadFileLayer extends common_1.Command {
    get options() {
        return Object.assign(Object.assign({}, (0, common_2.layerCommonOptions)('download')), {
            deprecateCmd: 'functions:layer:download',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                },
                {
                    flags: '--dest <dest>',
                    desc: '下载文件存放的地址'
                }
            ],
            desc: '下载云函数文件层'
        })
    }
    execute(envId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { dest } = options
            const functionService = yield (0, function_1.getFunctionService)(envId)
            const loading = (0, utils_1.loadingFactory)()
            loading.start('数据加载中...')
            const listLayersRes = yield functionService.listLayers({
                offset: 0,
                limit: 200
            })
            const layers = listLayersRes.Layers || []
            loading.stop()
            if (!layers.length) {
                throw new error_1.CloudBaseError('当前环境没有可用的文件层，请先创建文件层！')
            }
            const { layer } = yield (0, enquirer_1.prompt)({
                type: 'select',
                name: 'layer',
                message: '选择文件层名称',
                choices: layers.map((item) => item.LayerName)
            })
            let listLayerVersionsRes = yield functionService.listLayerVersions({
                name: layer
            })
            const layerVersions = listLayerVersionsRes.LayerVersions || []
            const versions = layerVersions.map((item) => String(item.LayerVersion))
            const { version } = yield (0, enquirer_1.prompt)({
                type: 'select',
                name: 'version',
                message: '选择文件层版本',
                choices: versions
            })
            let destPath
            if (!dest) {
                destPath = path_1.default.resolve(process.cwd(), 'layers')
            } else {
                destPath = path_1.default.resolve(dest)
            }
            loading.start('文件下载中...')
            yield fs_extra_1.default.ensureDir(destPath)
            yield functionService.downloadLayer({
                destPath,
                version: Number(version),
                name: layer
            })
            loading.succeed('文件下载成功！')
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
    DownloadFileLayer.prototype,
    'execute',
    null
)
DownloadFileLayer = __decorate([(0, common_1.ICommand)()], DownloadFileLayer)
exports.DownloadFileLayer = DownloadFileLayer
