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
exports.DeleteFileLayer = void 0
const enquirer_1 = require('enquirer')
const common_1 = require('../../common')
const utils_1 = require('../../../utils')
const error_1 = require('../../../error')
const decorators_1 = require('../../../decorators')
const function_1 = require('../../../function')
const common_2 = require('./common')
let DeleteFileLayer = class DeleteFileLayer extends common_1.Command {
    get options() {
        return Object.assign(Object.assign({}, (0, common_2.layerCommonOptions)('delete')), {
            deprecateCmd: 'functions:layer:delete',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                }
            ],
            desc: '删除当前环境的文件层'
        })
    }
    execute(envId) {
        return __awaiter(this, void 0, void 0, function* () {
            const loading = (0, utils_1.loadingFactory)()
            loading.start('数据加载中...')
            const functionService = yield (0, function_1.getFunctionService)(envId)
            const listLayersRes = yield functionService.listLayers({
                offset: 0,
                limit: 200
            })
            loading.stop()
            const layers = listLayersRes.Layers || []
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
            loading.start('文件层删除中...')
            yield functionService.deleteLayerVersion({
                name: layer,
                version: Number(version)
            })
            loading.succeed('文件层删除成功！')
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.EnvId)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object]),
        __metadata('design:returntype', Promise)
    ],
    DeleteFileLayer.prototype,
    'execute',
    null
)
DeleteFileLayer = __decorate([(0, common_1.ICommand)()], DeleteFileLayer)
exports.DeleteFileLayer = DeleteFileLayer
