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
exports.generateDataModelDTS = void 0
const json_schema_to_typescript_1 = require('json-schema-to-typescript')
const lodash_1 = require('lodash')
const tools_1 = require('./tools')
function generateDataModelDTS(dataModelList) {
    return __awaiter(this, void 0, void 0, function* () {
        const dtsList = yield Promise.all(
            dataModelList.map((item) =>
                __awaiter(this, void 0, void 0, function* () {
                    let dts = yield _handleOne(item.name, item.schema)
                    return {
                        name: item.name,
                        title: item.title,
                        dts
                    }
                })
            )
        )
        const result = `
import { DataModelMethods } from "@cloudbase/wx-cloud-client-sdk";
${dtsList.map((item) => item.dts).join('\n')}

interface IModels {
${dtsList
    .map((item) => {
        return `
    /**
    * 数据模型：${item.title}
    */ 
    ${_toValidFieldName(item.name)}: DataModelMethods<${getModelInterfaceName(item.name)}>;`
    })
    .join('\n')}    
}

declare module "@cloudbase/wx-cloud-client-sdk" {
    interface OrmClient extends IModels {}
}

declare global {
    interface WxCloud {
        models: IModels;
    }
}`
        return result
        function _handleOne(name, schema) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!(schema === null || schema === void 0 ? void 0 : schema.properties))
                    return `interface ${getModelInterfaceName(name)} {}`
                Object.keys(schema.properties).forEach((key) => {
                    if (schema.properties[key]['x-system']) {
                        delete schema.properties[key]
                    }
                })
                Object.keys(schema.properties).forEach((key) => {
                    const field = schema.properties[key]
                    if (['related', 'father-son'].includes(field.format)) {
                        schema.properties[`@${key}`] = {
                            type: 'object',
                            description: `关联${field.title}对象`,
                            properties: {
                                v1: {
                                    type: 'object',
                                    properties: {
                                        record: {
                                            type: 'string',
                                            format: field.format,
                                            'x-parent': {
                                                parentDataSourceName:
                                                    field['x-parent'].parentDataSourceName
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        schema.properties[key].format = ''
                    }
                })
                schema = JSON.parse(
                    JSON.stringify(schema, (_, value) => {
                        if (
                            (0, lodash_1.has)(value, 'title') &&
                            !(0, lodash_1.has)(value, 'title.title')
                        ) {
                            ;(0, lodash_1.set)(
                                value,
                                'description',
                                value['title'] + '\n' + value['description']
                            )
                            delete value['title']
                        }
                        return value
                    })
                )
                const dts = yield _compile(name, schema)
                return dts
            })
        }
        function _compile(name, jsonschema) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    let dts = yield (0, json_schema_to_typescript_1.compile)(
                        jsonschema,
                        getModelInterfaceName(name),
                        {
                            additionalProperties: false,
                            bannerComment: '',
                            format: true,
                            unknownAny: false,
                            customName(_schema) {
                                var _a, _b
                                const format = _schema.format
                                let name = ''
                                if (
                                    ['one-one', 'many-one', 'related', 'father-son'].includes(
                                        format
                                    )
                                ) {
                                    name = getModelInterfaceName(
                                        (_a =
                                            _schema === null || _schema === void 0
                                                ? void 0
                                                : _schema['x-parent']) === null || _a === void 0
                                            ? void 0
                                            : _a.parentDataSourceName
                                    )
                                }
                                if (['one-many', 'many-many'].includes(format)) {
                                    name = `ARRAY_TYPE_${getModelInterfaceName((_b = _schema === null || _schema === void 0 ? void 0 : _schema['x-parent']) === null || _b === void 0 ? void 0 : _b.parentDataSourceName)}`
                                }
                                if (name) {
                                    name = `${name}_TAIL${(0, tools_1.uuidv4)()}_END_`
                                }
                                return name || undefined
                            }
                        }
                    )
                    dts = dts
                        .replace(/export interface/g, 'interface')
                        .replace(/ARRAY_TYPE_(.*);/g, '$1[]')
                        .replace(/_TAIL.*?_END_/g, '')
                        .replace(/[\s\S]*?(?=interface)/, '')
                    return dts
                } catch (e) {
                    console.error('_compile error:', e)
                    return ''
                }
            })
        }
        function _toValidFieldName(name) {
            let result = name.replace(/[^a-zA-Z0-9_$]/g, '_')
            if (/^[0-9]/.test(result)) {
                result = '_' + result
            }
            return result
        }
        function getModelInterfaceName(name) {
            if (!name) return ''
            return (0, lodash_1.upperFirst)(
                (0, lodash_1.deburr)(`IModal_${name}`)
                    .replace(/(^\s*[^a-zA-Z_$])|([^a-zA-Z_$\d])/g, ' ')
                    .replace(/^_[a-z]/g, (match) => match.toUpperCase())
                    .replace(/_[a-z]/g, (match) => match.substr(1, match.length).toUpperCase())
                    .replace(/([\d$]+[a-zA-Z])/g, (match) => match.toUpperCase())
                    .replace(/\s+([a-zA-Z])/g, (match) => (0, lodash_1.trim)(match.toUpperCase()))
                    .replace(/\s/g, '')
            )
        }
    })
}
exports.generateDataModelDTS = generateDataModelDTS
