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
exports.publishModel =
    exports.getModel =
    exports.updateModel =
    exports.createModel =
    exports.listModels =
        void 0
const net_1 = require('../utils/net')
const lowCodeService = new net_1.CloudApiService('lowcode', {}, '2021-01-08')
function listModels(options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const { envId } = options
        const datasourceList = yield lowCodeService.request('DescribeDataSourceList', {
            EnvId: envId,
            PageIndex: 1,
            PageSize: 1000,
            DataSourceNames: options.name,
            QuerySystemModel: true,
            QueryConnector: 0,
            QueryDataSourceRelationList: true
        })
        const rows = datasourceList.Data.Rows
        return rows
    })
}
exports.listModels = listModels
function createModel({ envId, name, title, schema }) {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield lowCodeService.request('CreateDataSourceDetail', {
            EnvId: envId,
            Title: title,
            Name: name,
            Type: 'database',
            TableNameRule: 'only_name',
            Schema: JSON.stringify(schema)
        })).Data
    })
}
exports.createModel = createModel
function updateModel({ envId, id, title, schema }) {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield lowCodeService.request('ModifyDataSource', {
            Id: id,
            EnvId: envId,
            Title: title,
            Schema: JSON.stringify(schema)
        })).Data
    })
}
exports.updateModel = updateModel
function getModel(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { envId, name } = options
        try {
            return (yield lowCodeService.request('DescribeDataSource', {
                EnvId: envId,
                Name: name
            })).Data
        } catch (e) {
            if (e.original.Code === 'ResourceNotFound') {
                return null
            } else {
                throw e
            }
        }
    })
}
exports.getModel = getModel
function publishModel(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { envId, ids } = options
        return (yield lowCodeService.request('BatchPublishDataSources', {
            EnvId: envId,
            DataSourceIds: ids
        })).Data
    })
}
exports.publishModel = publishModel
