"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudFunctionRunCommand = exports.CloudFunctionDownloadCommand = exports.CloudFunctionDeployCommand = void 0;
const functions_framework_1 = require("@cloudbase/functions-framework");
const iac_core_1 = require("@cloudbase/iac-core");
const camelcase_keys_1 = __importDefault(require("camelcase-keys"));
const inquirer_1 = __importDefault(require("inquirer"));
const nodemon = (() => { try {
    return require('nodemon');
}
catch (_a) {
    return null;
} })();
const path_1 = __importDefault(require("path"));
const decorators_1 = require("../../decorators");
const common_1 = require("../common");
const constants_1 = require("../constants");
const utils_1 = require("../utils");
let CloudFunctionDeployCommand = class CloudFunctionDeployCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'cloudfunction',
            childCmd: 'deploy',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                },
                {
                    flags: '-s, --serviceName <serviceName>',
                    desc: '服务名称'
                },
                {
                    flags: '--source <source>',
                    desc: '目标函数文件所在目录路径。默认为当前路径'
                }
            ],
            requiredEnvId: false,
            autoRunLogin: true,
            desc: '部署云函数服务'
        };
    }
    execute(ctx, envId, log, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let { serviceName, source } = options;
            const targetDir = path_1.default.resolve(source || process.cwd());
            if (!envId) {
                const envConfig = (0, camelcase_keys_1.default)(yield iac_core_1.utils.loadEnv(targetDir));
                if (envConfig.envId) {
                    envId = envConfig.envId;
                    log.info(`当前环境 Id：${envId}`);
                }
                else {
                    envId = yield _selectEnv();
                }
            }
            else {
                log.info(`当前环境 Id：${envId}`);
            }
            if (!serviceName) {
                const { shortName } = yield (0, utils_1.getPackageJsonName)(path_1.default.join(targetDir, 'package.json'));
                serviceName = yield _inputServiceName(shortName);
            }
            const answers = yield inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `即将开始部署，是否确认继续？`,
                    default: true
                }
            ]);
            if (!answers.confirm) {
                return;
            }
            yield iac_core_1.IAC.init({
                cwd: targetDir,
                getCredential: () => {
                    return (0, utils_1.getCredential)(ctx, options);
                },
                polyRepoMode: true
            });
            yield _runDeploy();
            function _runDeploy() {
                var _a;
                return __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield iac_core_1.IAC.Function.apply({
                            cwd: targetDir,
                            envId: envId,
                            name: serviceName
                        }, function (message) {
                            (0, utils_1.trackCallback)(message, log);
                        });
                    }
                    catch (e) {
                        if ((e === null || e === void 0 ? void 0 : e.action) === 'UpdateFunctionConfiguration' &&
                            ((_a = e === null || e === void 0 ? void 0 : e.message) === null || _a === void 0 ? void 0 : _a.includes('当前函数处于Updating状态，无法进行此操作，请稍后重试'))) {
                            (0, utils_1.trackCallback)({
                                type: 'error',
                                details: '当前函数处于更新状态，无法进行此操作，请稍后重试',
                                originalError: e
                            }, log);
                        }
                        else {
                            (0, utils_1.trackCallback)({
                                type: 'error',
                                details: `${e.message}`,
                                originalError: e
                            }, log);
                        }
                    }
                });
            }
        });
    }
};
__decorate([
    (0, decorators_1.InjectParams)(),
    __param(0, (0, decorators_1.CmdContext)()),
    __param(1, (0, decorators_1.EnvId)()),
    __param(2, (0, decorators_1.Log)()),
    __param(3, (0, decorators_1.ArgsOptions)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, decorators_1.Logger, Object]),
    __metadata("design:returntype", Promise)
], CloudFunctionDeployCommand.prototype, "execute", null);
CloudFunctionDeployCommand = __decorate([
    (0, common_1.ICommand)()
], CloudFunctionDeployCommand);
exports.CloudFunctionDeployCommand = CloudFunctionDeployCommand;
let CloudFunctionDownloadCommand = class CloudFunctionDownloadCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'cloudfunction',
            childCmd: 'download',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                },
                {
                    flags: '-s, --serviceName <serviceName>',
                    desc: '服务名称'
                },
                {
                    flags: '--source <source>',
                    desc: '目标函数文件所在目录路径。默认为当前路径'
                }
            ],
            requiredEnvId: false,
            autoRunLogin: true,
            desc: '下载云函数服务代码'
        };
    }
    execute(ctx, envId, log, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let { serviceName, source } = options;
            let targetDir = path_1.default.resolve(source || process.cwd());
            if (!envId) {
                const envConfig = (0, camelcase_keys_1.default)(yield iac_core_1.utils.loadEnv(targetDir));
                envId = envConfig.envId || (yield _selectEnv());
            }
            else {
                log.info(`当前环境 Id：${envId}`);
            }
            if (!serviceName) {
                const { shortName } = yield (0, utils_1.getPackageJsonName)(path_1.default.join(targetDir, 'package.json'));
                serviceName = yield _inputServiceName(shortName);
                if (serviceName !== shortName) {
                    targetDir = path_1.default.join(targetDir, serviceName);
                }
            }
            const needTips = !(yield (0, utils_1.isDirectoryEmptyOrNotExists)(targetDir));
            if (needTips) {
                const answers = yield inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: `下载将覆盖 ${targetDir} 目录下的代码，是否继续？`,
                        default: true
                    }
                ]);
                if (!answers.confirm) {
                    return;
                }
            }
            yield iac_core_1.IAC.init({
                cwd: targetDir,
                getCredential: () => {
                    return (0, utils_1.getCredential)(ctx, options);
                },
                polyRepoMode: true
            });
            try {
                yield iac_core_1.IAC.Function.pull({
                    cwd: targetDir,
                    envId: envId,
                    name: serviceName
                }, function (message) {
                    (0, utils_1.trackCallback)(message, log);
                });
            }
            catch (e) {
                (0, utils_1.trackCallback)({
                    type: 'error',
                    details: `${e.message}`,
                    originalError: e
                }, log);
            }
        });
    }
};
__decorate([
    (0, decorators_1.InjectParams)(),
    __param(0, (0, decorators_1.CmdContext)()),
    __param(1, (0, decorators_1.EnvId)()),
    __param(2, (0, decorators_1.Log)()),
    __param(3, (0, decorators_1.ArgsOptions)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, decorators_1.Logger, Object]),
    __metadata("design:returntype", Promise)
], CloudFunctionDownloadCommand.prototype, "execute", null);
CloudFunctionDownloadCommand = __decorate([
    (0, common_1.ICommand)()
], CloudFunctionDownloadCommand);
exports.CloudFunctionDownloadCommand = CloudFunctionDownloadCommand;
let CloudFunctionRunCommand = class CloudFunctionRunCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'cloudfunction',
            childCmd: 'run',
            options: [
                {
                    flags: '--source <source>',
                    desc: `目标函数文件所在目录路径，默认为当前路径
                    `
                },
                {
                    flags: '--port <port>',
                    desc: `监听的端口，默认为 3000
                    `
                },
                {
                    flags: '-w, --watch',
                    desc: `是否启用热重启模式，如启用，将会在文件变更时自动重启服务，默认为 false
                    `
                }
            ],
            requiredEnvId: false,
            desc: '本地运行云函数代码'
        };
    }
    execute(logger, ctx, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = process.argv.slice(2);
            const watchFlag = ['--watch', '-w'];
            const defaultIgnoreFiles = ['logs/*.*'];
            const envConfig = (0, camelcase_keys_1.default)(yield iac_core_1.utils.loadEnv(process.cwd()));
            const credential = yield (0, utils_1.getCredential)(ctx, options);
            process.env.TCB_ENV = envConfig.envId;
            process.env.TENCENTCLOUD_SECRETID = credential.secretId;
            process.env.TENCENTCLOUD_SECRETKEY = credential.secretKey;
            process.env.TENCENTCLOUD_SESSIONTOKEN = credential.token;
            if (watchFlag.some((flag) => args.includes(flag))) {
                const cmd = args.filter((arg) => !watchFlag.includes(arg)).join(' ');
                if (!nodemon) {
                    throw new Error('缺少开发依赖 nodemon，独立发行版已不内置。请在本地开发环境中安装再使用该命令。');
                }
                nodemon({
                    script: '',
                    exec: `${process.argv[1]} ${cmd}`,
                    watchOptions: {
                        usePolling: true,
                        ignorePermissionErrors: true,
                        ignored: defaultIgnoreFiles.join(','),
                        persistent: true,
                        interval: 500
                    }
                })
                    .on('start', () => {
                    logger.info('Initializing server in watch mode. Changes in source files will trigger a restart.');
                })
                    .on('quit', (e) => {
                    logger.info(`Nodemon quit with code ${e}.`);
                    process.exit(0);
                })
                    .on('restart', (e) => {
                    var _a, _b;
                    logger.info(`Server restarted due to changed files: ${(_b = (_a = e === null || e === void 0 ? void 0 : e.matched) === null || _a === void 0 ? void 0 : _a.result) === null || _b === void 0 ? void 0 : _b.join(', ')}`);
                })
                    .on('log', (e) => {
                    logger.info(`[nodemon ${e.type}] ${e.message}`);
                })
                    .on('crash', () => {
                    logger.error(`Server crashed.`);
                    process.exit(1);
                })
                    .on('exit', (e) => {
                    logger.info(`Server exited with code ${e}.`);
                });
            }
            else {
                (0, functions_framework_1.runCLI)();
            }
        });
    }
};
__decorate([
    (0, decorators_1.InjectParams)(),
    __param(0, (0, decorators_1.Log)()),
    __param(1, (0, decorators_1.CmdContext)()),
    __param(2, (0, decorators_1.ArgsOptions)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [decorators_1.Logger, Object, Object]),
    __metadata("design:returntype", Promise)
], CloudFunctionRunCommand.prototype, "execute", null);
CloudFunctionRunCommand = __decorate([
    (0, common_1.ICommand)()
], CloudFunctionRunCommand);
exports.CloudFunctionRunCommand = CloudFunctionRunCommand;
function _selectEnv() {
    return __awaiter(this, void 0, void 0, function* () {
        return (0, utils_1.selectEnv)({ source: [constants_1.EnvSource.MINIAPP, constants_1.EnvSource.QCLOUD] });
    });
}
function _inputServiceName(defaultVal = '') {
    return __awaiter(this, void 0, void 0, function* () {
        const questions = [
            {
                type: 'input',
                name: 'serviceName',
                message: '请输入服务名称',
                default: defaultVal,
                validate: (val) => {
                    const isValid = !val.startsWith('lcap') &&
                        !val.startsWith('lowcode') &&
                        /^[A-Za-z][\w-_]{0,43}[A-Za-z0-9]$/.test(val);
                    return isValid
                        ? true
                        : '支持大小写字母、数字、-和_，但必须以字母开头、以字母和数字结尾，不支持以lcap、lowcode开头，最长45个字符';
                }
            }
        ];
        const answers = yield inquirer_1.default.prompt(questions);
        return answers['serviceName'];
    });
}
