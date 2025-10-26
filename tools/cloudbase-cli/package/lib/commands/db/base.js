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
exports.DbPushCommand = exports.DbPullCommand = exports.DbListCommand = void 0
const path_1 = __importDefault(require('path'))
const common_1 = require('../common')
const error_1 = require('../../error')
const lodash_1 = require('lodash')
const db_1 = require('../../db')
const env_1 = require('../../env')
const decorators_1 = require('../../decorators')
const utils_1 = require('../../utils')
const inquirer_1 = __importDefault(require('inquirer'))
const fs_extra_1 = __importDefault(require('fs-extra'))
const dts_1 = require('../../utils/dts')
let DbListCommand = class DbListCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'db',
            childCmd: 'list',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                }
            ],
            requiredEnvId: false,
            autoRunLogin: true,
            desc: '列出云端所有数据模型'
        }
    }
    execute(envId, log) {
        return __awaiter(this, void 0, void 0, function* () {
            const loading = (0, utils_1.loadingFactory)()
            if (!envId) {
                envId = yield selectEnv()
            } else {
                log.info(`当前环境 Id：${envId}`)
            }
            if (!(yield fs_extra_1.default.pathExists('cloudbaserc.json'))) {
                yield fs_extra_1.default.writeFile(
                    'cloudbaserc.json',
                    JSON.stringify(
                        {
                            version: '2.0',
                            envId
                        },
                        null,
                        2
                    ),
                    'utf8'
                )
            }
            loading.start('数据加载中...')
            const data = yield (0, db_1.listModels)({ envId })
            loading.stop()
            const head = ['名称', '标识', '创建时间']
            const sortData = data.sort((prev, next) => {
                if (prev.Alias > next.Alias) {
                    return 1
                }
                if (prev.Alias < next.Alias) {
                    return -1
                }
                return 0
            })
            const tableData = sortData.map((item) => [item.Title, item.Name, item.CreatedAt])
            ;(0, utils_1.printHorizontalTable)(head, tableData)
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.EnvId)()),
        __param(1, (0, decorators_1.Log)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object, decorators_1.Logger]),
        __metadata('design:returntype', Promise)
    ],
    DbListCommand.prototype,
    'execute',
    null
)
DbListCommand = __decorate([(0, common_1.ICommand)()], DbListCommand)
exports.DbListCommand = DbListCommand
let DbPullCommand = class DbPullCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'db',
            childCmd: 'pull',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                },
                {
                    flags: '-d, --dir <dir>',
                    desc: '本地存储数据库模型定义的目录，默认为 database-schemas'
                },
                {
                    flags: '-n, --name <name>',
                    desc: '要拉取的模型英文标识列表，可指定多个,使用逗号分隔.不指定的情况下默认会拉取所有模型'
                }
            ],
            requiredEnvId: false,
            autoRunLogin: true,
            desc: '从云端拉取多个数据模型到本地'
        }
    }
    execute(envId, params, log) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield fs_extra_1.default.pathExists('tsconfig.json'))) {
                yield fs_extra_1.default.writeFile(
                    'tsconfig.json',
                    JSON.stringify(
                        {
                            compilerOptions: {
                                allowJs: true
                            }
                        },
                        null,
                        2
                    ),
                    'utf8'
                )
            } else {
                const config = yield fs_extra_1.default.readJson('tsconfig.json', 'utf8')
                ;(0, lodash_1.set)(config, 'compilerOptions.allowJs', true)
                yield fs_extra_1.default.writeFile(
                    'tsconfig.json',
                    JSON.stringify(config, null, 2),
                    'utf8'
                )
            }
            if (!envId) {
                envId = yield selectEnv()
            } else {
                log.info(`当前环境 Id：${envId}`)
            }
            if (!(yield fs_extra_1.default.pathExists('cloudbaserc.json'))) {
                yield fs_extra_1.default.writeFile(
                    'cloudbaserc.json',
                    JSON.stringify(
                        {
                            version: '2.0',
                            envId
                        },
                        null,
                        2
                    ),
                    'utf8'
                )
            }
            let { name = '', dir } = params
            name = name
                .split(',')
                .map((item) => item.trim())
                .filter((item) => item)
            if (!name.length) {
                name = yield selectModel(envId)
            }
            const data = yield (0, db_1.listModels)({
                envId,
                name
            })
            const dataModelList = data.map((item) => {
                const schema = JSON.parse(item.Schema)
                schema.title = item.Title
                return {
                    name: item.Name,
                    schema,
                    title: item.Title
                }
            })
            if (!dir) {
                dir = 'database-schemas'
                if (!fs_extra_1.default.existsSync(dir)) {
                    fs_extra_1.default.mkdirSync(dir)
                }
                dataModelList.forEach((item) => {
                    const fileName = `${dir}/${item.name}.json`
                    fs_extra_1.default.writeFileSync(fileName, JSON.stringify(item.schema, null, 4))
                    log.success(`同步数据模型成功。文件名称：${fileName}`)
                })
            }
            const dts = yield (0, dts_1.generateDataModelDTS)(dataModelList)
            const dtsFileName = 'cloud-models.d.ts'
            yield fs_extra_1.default.writeFile(dtsFileName, dts)
            log.success(
                '同步数据模型类型定义文件成功，调用 SDK 时可支持智能字段提示。文件名称：' +
                    dtsFileName
            )
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.EnvId)()),
        __param(1, (0, decorators_1.ArgsParams)()),
        __param(2, (0, decorators_1.Log)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object, Object, decorators_1.Logger]),
        __metadata('design:returntype', Promise)
    ],
    DbPullCommand.prototype,
    'execute',
    null
)
DbPullCommand = __decorate([(0, common_1.ICommand)()], DbPullCommand)
exports.DbPullCommand = DbPullCommand
let DbPushCommand = class DbPushCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'db',
            childCmd: 'push',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                },
                {
                    flags: '-d, --dir <dir>',
                    desc: '本地存储数据库模型定义的目录，默认为 database-schemas'
                },
                {
                    flags: '-n, --name <name>',
                    desc: '要推送的模型名称列表，可指定多个,使用逗号分隔.不指定的情况下默认会推送本地目录下的所有数据模型'
                }
            ],
            requiredEnvId: false,
            autoRunLogin: true,
            desc: '将本地数据模型推送到云端'
        }
    }
    execute(envId, params, log) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!envId) {
                envId = yield selectEnv()
            } else {
                log.info(`使用环境 Id：${envId}`)
            }
            let { name = '', dir } = params
            name = name
                .split(',')
                .map((item) => item.trim())
                .filter((item) => item)
            if (!dir) {
                dir = 'database-schemas'
                if (!fs_extra_1.default.existsSync(dir)) {
                    throw new error_1.CloudBaseError(`目录 ${dir} 不存在，请指定正确的目录`)
                }
            }
            if (!name.length) {
                name = fs_extra_1.default.readdirSync(dir).map((item) => item.replace('.json', ''))
            }
            if (!name.length) {
                throw new error_1.CloudBaseError(`目录 ${dir} 中没有找到任何数据模型`)
            }
            const ids = []
            for (const modelName of name) {
                log.info(`开始检查数据模型 ${modelName}`)
                const modelPath = path_1.default.join(process.cwd(), dir, `${modelName}.json`)
                const model = require(modelPath)
                const existModel = yield (0, db_1.getModel)({
                    envId,
                    name: modelName
                })
                if (existModel) {
                    const confirm = yield inquirer_1.default.prompt([
                        {
                            type: 'confirm',
                            name: 'confirm',
                            message: `数据模型 ${modelName} 已存在，是否更新？`
                        }
                    ])
                    if (!confirm.confirm) {
                        log.info(`跳过更新数据模型 ${modelName}`)
                        continue
                    }
                    yield (0, db_1.updateModel)({
                        envId,
                        id: existModel.Id,
                        title: model.title || existModel.Title,
                        schema: model
                    })
                    ids.push(existModel.Id)
                    const link = (0, utils_1.genClickableLink)(
                        `https://tcb.cloud.tencent.com/cloud-admin/#/management/data-model/${existModel.Id}}`
                    )
                    log.success(`更新数据模型 ${modelName} 成功，点击查看 ${link}`)
                } else {
                    const confirm = yield inquirer_1.default.prompt([
                        {
                            type: 'confirm',
                            name: 'confirm',
                            message: `数据模型 ${modelName} 不存在，是否创建？`
                        }
                    ])
                    if (!confirm.confirm) {
                        log.info(`跳过创建数据模型 ${modelName}`)
                        continue
                    }
                    const createModelRes = yield (0, db_1.createModel)({
                        envId,
                        name: modelName,
                        title: model.title || modelName,
                        schema: model
                    })
                    ids.push(createModelRes.Id)
                    const link = (0, utils_1.genClickableLink)(
                        `https://tcb.cloud.tencent.com/cloud-admin/#/management/data-model/${createModelRes.Id}}`
                    )
                    log.success(`创建数据模型 ${modelName} 成功, 点击查看 ${link}`)
                }
            }
            const confirmPublish = yield inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `数据模型已经导入成功，是否发布？`
                }
            ])
            if (confirmPublish.confirm) {
                const publishRes = yield (0, db_1.publishModel)({
                    envId,
                    ids
                })
            }
        })
    }
}
__decorate(
    [
        (0, decorators_1.InjectParams)(),
        __param(0, (0, decorators_1.EnvId)()),
        __param(1, (0, decorators_1.ArgsParams)()),
        __param(2, (0, decorators_1.Log)()),
        __metadata('design:type', Function),
        __metadata('design:paramtypes', [Object, Object, decorators_1.Logger]),
        __metadata('design:returntype', Promise)
    ],
    DbPushCommand.prototype,
    'execute',
    null
)
DbPushCommand = __decorate([(0, common_1.ICommand)()], DbPushCommand)
exports.DbPushCommand = DbPushCommand
function selectEnv() {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield (0, env_1.listEnvs)()
        const sortData = data.sort((prev, next) => {
            if (prev.Alias > next.Alias) {
                return 1
            }
            if (prev.Alias < next.Alias) {
                return -1
            }
            return 0
        })
        const choices = sortData.map((item) => {
            return {
                name: `${item.Alias || item.EnvId}  (${item.EnvId}) ${item.Status === 'NORMAL' ? '正常' : '不可用'}`,
                value: item.EnvId,
                short: item.envId
            }
        })
        const questions = [
            {
                type: 'list',
                name: 'env',
                message: '请先选择一个云开发环境',
                choices: choices
            }
        ]
        const answers = yield inquirer_1.default.prompt(questions)
        return answers.env
    })
}
function selectModel(envId) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield (0, db_1.listModels)({
            envId
        })
        const sortData = data.sort((prev, next) => {
            if (prev.CreatedAt > next.CreatedAt) {
                return 1
            }
            if (prev.CreatedAt < next.CreatedAt) {
                return -1
            }
            return 0
        })
        const choices = sortData.map((item) => {
            return {
                name: `${item.Title}  (${item.Name})`,
                value: item.Name,
                short: item.Name
            }
        })
        const questions = [
            {
                type: 'checkbox',
                name: 'model',
                message: '请选择数据模型',
                choices: choices
            }
        ]
        const answers = yield inquirer_1.default.prompt(questions)
        return answers.model
    })
}
