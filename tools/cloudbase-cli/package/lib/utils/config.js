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
exports.getCloudBaseConfig = exports.getPrivateSettings = exports.getArgs = void 0
const lodash_1 = __importDefault(require('lodash'))
const path_1 = __importDefault(require('path'))
const yargs_1 = __importDefault(require('yargs'))
const toolbox_1 = require('@cloudbase/toolbox')
const getArgs = () => {
    return yargs_1.default
        .help(false)
        .alias('e', 'envId')
        .alias('r', 'region')
        .alias('v', 'version').argv
}
exports.getArgs = getArgs
const hasOwn = (obj, name) => {
    return Object.prototype.hasOwnProperty.call(obj !== null && obj !== void 0 ? obj : {}, name)
}
function getPrivateSettings(config, cmd) {
    const commonConfig = config
    const currentConfig = cmd
        ? config === null || config === void 0
            ? void 0
            : config[cmd]
        : config
    if (
        hasOwn(currentConfig || {}, 'privateSettings') ||
        hasOwn(commonConfig || {}, 'privateSettings')
    ) {
        return Object.assign(
            Object.assign({}, commonConfig.privateSettings),
            currentConfig.privateSettings
        )
    }
    return undefined
}
exports.getPrivateSettings = getPrivateSettings
const getCloudBaseConfig = (configPath) =>
    __awaiter(void 0, void 0, void 0, function* () {
        var _a
        const args = (0, exports.getArgs)()
        if (args._.includes('help') || args.help) {
            return { functions: [], envId: '' }
        }
        let specificConfigPath = configPath || args.configPath
        specificConfigPath = specificConfigPath
            ? path_1.default.resolve(specificConfigPath)
            : undefined
        const parser = new toolbox_1.ConfigParser({
            configPath: specificConfigPath
        })
        const config = yield parser.get()
        if (
            (config === null || config === void 0 ? void 0 : config.functionDefaultConfig) &&
            ((_a = config === null || config === void 0 ? void 0 : config.functions) === null ||
            _a === void 0
                ? void 0
                : _a.length)
        ) {
            config.functions = config.functions.map((rawConfig) =>
                lodash_1.default.merge({}, config.functionDefaultConfig, rawConfig)
            )
        }
        return config
    })
exports.getCloudBaseConfig = getCloudBaseConfig
