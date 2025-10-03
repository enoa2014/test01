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
exports.Command = exports.registerCommands = exports.ICommand = void 0
const chalk_1 = __importDefault(require('chalk'))
const events_1 = require('events')
const commander_1 = require('commander')
const yargs_parser_1 = __importDefault(require('yargs-parser'))
const error_1 = require('../error')
const toolbox_1 = require('@cloudbase/toolbox')
const utils_1 = require('../utils')
const auth_1 = require('../auth')
const report_1 = require('../utils/report')
const registrableCommands = []
const cmdMap = new Map()
const defaultCmdDecoratorOpts = {
    supportPrivate: false
}
function ICommand(options = defaultCmdDecoratorOpts) {
    return (target) => {
        registrableCommands.push({ Command: target, decoratorOptions: options })
    }
}
exports.ICommand = ICommand
function registerCommands() {
    var _a, _b
    return __awaiter(this, void 0, void 0, function* () {
        const args = (0, yargs_parser_1.default)(process.argv.slice(2))
        const config = yield (0, utils_1.getCloudBaseConfig)(args.configFile)
        const isPrivate = (0, utils_1.getPrivateSettings)(
            config,
            (_b =
                (_a = args === null || args === void 0 ? void 0 : args._) === null || _a === void 0
                    ? void 0
                    : _a[0]) === null || _b === void 0
                ? void 0
                : _b.toString()
        )
        registrableCommands.forEach(({ Command, decoratorOptions }) => {
            if (isPrivate) {
                if (decoratorOptions.supportPrivate) {
                    const command = new Command()
                    command.init()
                }
            } else {
                if (decoratorOptions.supportPrivate !== 'only') {
                    const command = new Command()
                    command.init()
                }
            }
        })
    })
}
exports.registerCommands = registerCommands
class Command extends events_1.EventEmitter {
    on(event, listener) {
        super.on(event, listener)
        return this
    }
    init() {
        const { cmd, childCmd, childSubCmd, deprecateCmd } = this.options
        let instance
        if (cmdMap.has(cmd)) {
            instance = cmdMap.get(cmd)
        } else {
            instance = commander_1.program.command(cmd)
            instance._helpDescription = '输出帮助信息'
            instance.addHelpCommand('help [command]', '查看命令帮助信息')
            cmdMap.set(cmd, instance)
        }
        if (childCmd) {
            let cmdKey
            let cmdName
            let desc
            if (typeof childCmd === 'string') {
                cmdKey = `${cmd}-${childCmd}`
                cmdName = childCmd
            } else {
                cmdKey = `${cmd}-${childCmd.cmd}`
                cmdName = childCmd.cmd
                desc = childCmd.desc
            }
            if (cmdMap.has(cmdKey)) {
                instance = cmdMap.get(cmdKey)
            } else {
                instance = instance.command(cmdName)
                instance._helpDescription = '查看命令帮助信息'
                desc && instance.description(desc)
                cmdMap.set(cmdKey, instance)
            }
            if (childSubCmd) {
                instance = instance.command(childSubCmd)
            }
        }
        this.createProgram(instance, false)
        if (deprecateCmd) {
            const newCmd = [cmd, childCmd, childSubCmd]
                .filter((_) => _)
                .map((item) => {
                    if (typeof item === 'string') return item
                    return item.cmd
                })
                .join(' ')
            this.createProgram(commander_1.program.command(deprecateCmd), true, newCmd)
        }
    }
    createProgram(instance, deprecate, newCmd) {
        const {
            cmd,
            childCmd,
            desc,
            options,
            requiredEnvId = true,
            withoutAuth = false,
            autoRunLogin = false,
            allowUnknownOption = false
        } = this.options
        if (allowUnknownOption) {
            instance.allowUnknownOption()
        }
        instance.storeOptionsAsProperties(false)
        options.forEach((option) => {
            const { hideHelp } = option
            if (hideHelp) {
                instance.addOption(new commander_1.Option(option.flags, option.desc).hideHelp())
            } else {
                instance.option(option.flags, option.desc)
            }
        })
        instance.description(desc)
        instance.action((...args) =>
            __awaiter(this, void 0, void 0, function* () {
                const params = args.slice(0, -1)
                const cmdOptions = instance.opts()
                const parentOptions = commander_1.program.opts()
                const config = yield (0, utils_1.getCloudBaseConfig)(
                    parentOptions === null || parentOptions === void 0
                        ? void 0
                        : parentOptions.configFile
                )
                const envId =
                    (cmdOptions === null || cmdOptions === void 0 ? void 0 : cmdOptions.envId) ||
                    (config === null || config === void 0 ? void 0 : config.envId)
                const privateSettings = (0, utils_1.getPrivateSettings)(config, cmd)
                let loginState
                if (privateSettings) {
                    loginState = privateSettings.credential
                } else {
                    loginState = yield utils_1.authSupevisor.getLoginState()
                }
                if (!withoutAuth && !loginState) {
                    if (autoRunLogin) {
                        console.log(
                            chalk_1.default.bold.yellowBright(
                                '无有效身份信息，将自动为您打开授权页面。'
                            )
                        )
                        const execResult = yield (0, toolbox_1.execWithLoading)(
                            () => (0, auth_1.login)(),
                            {
                                startTip: '请在浏览器中打开的授权页面进行授权...',
                                successTip: '授权登录成功！'
                            }
                        )
                        loginState = execResult.credential
                    } else {
                        throw new error_1.CloudBaseError(
                            '无有效身份信息，请使用 cloudbase login 登录'
                        )
                    }
                }
                if (!envId && requiredEnvId) {
                    throw new error_1.CloudBaseError(
                        '未识别到有效的环境 Id，请使用 cloudbaserc 配置文件进行操作或通过 -e 参数指定环境 Id'
                    )
                }
                report_1.beaconAction.addAdditionalParams({
                    login_uin:
                        loginState === null || loginState === void 0 ? void 0 : loginState['uin'],
                    envId:
                        envId ||
                        (loginState === null || loginState === void 0
                            ? void 0
                            : loginState['envId'])
                })
                try {
                    yield report_1.beaconAction.report('tcb_cli_exec_command', {
                        cmd,
                        childCmd,
                        desc
                    })
                } catch (error) {}
                const ctx = {
                    cmd,
                    envId,
                    config,
                    params,
                    options: cmdOptions,
                    hasPrivateSettings: Boolean(privateSettings)
                }
                this.emit('preHandle', ctx, args.slice(0, -1))
                yield this.preHandle()
                if (deprecate) {
                    console.log(
                        chalk_1.default.bold.yellowBright(
                            '\n',
                            `⚠️  此命令将被废弃，请使用新的命令 tcb ${newCmd} 代替`
                        ),
                        '\n'
                    )
                }
                yield this.execute(ctx)
                this.emit('afterHandle', ctx, args)
                this.afterHandle(ctx)
            })
        )
    }
    preHandle() {
        return __awaiter(this, void 0, void 0, function* () {
            const loading = (0, utils_1.loadingFactory)()
            try {
                loading.start('数据加载中...')
                const res = yield (0, utils_1.getNotification)()
                loading.stop()
                if (!res) return
                const { title, content } = res
                console.log(chalk_1.default.bold.cyan(title))
                console.log(content, '\n')
            } catch (e) {
                loading.stop()
            }
        })
    }
    afterHandle(ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { cmd } = ctx
                const agree = yield utils_1.usageStore.get('agreeCollect')
                if (!agree) return
                yield (0, utils_1.collectUsage)(cmd)
            } catch (e) {}
        })
    }
}
exports.Command = Command
