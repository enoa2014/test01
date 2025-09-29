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
exports.FunctionDeploy = void 0;
const path_1 = __importDefault(require("path"));
const inquirer_1 = __importDefault(require("inquirer"));
const toolbox_1 = require("@cloudbase/toolbox");
const common_1 = require("../common");
const error_1 = require("../../error");
const function_1 = require("../../function");
const gateway_1 = require("../../gateway");
const utils_1 = require("../../utils");
const constant_1 = require("../../constant");
const decorators_1 = require("../../decorators");
const function_2 = require("../../function");
const regionIdMap = {
    'ap-guangzhou': 1,
    'ap-shanghai': 4,
    'ap-beijing': 8
};
let FunctionDeploy = class FunctionDeploy extends common_1.Command {
    get options() {
        return {
            cmd: 'fn',
            childCmd: 'deploy [name]',
            deprecateCmd: 'functions:deploy [name]',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                },
                {
                    flags: '--code-secret <codeSecret>',
                    desc: '传入此参数将保护代码，格式为 36 位大小写字母和数字'
                },
                {
                    flags: '--force',
                    desc: '如果存在同名函数，上传后覆盖同名函数'
                },
                {
                    flags: '--path <path>',
                    desc: '自动创建HTTP 访问服务访问路径'
                },
                {
                    flags: '--all',
                    desc: '部署配置文件中的包含的全部云函数'
                },
                {
                    flags: '--dir <dir>',
                    desc: '指定云函数的文件夹路径'
                }
            ],
            desc: '部署云函数'
        };
    }
    execute(ctx, params, log) {
        return __awaiter(this, void 0, void 0, function* () {
            const { envId, config, options } = ctx;
            const { functions } = config;
            const { force, codeSecret, path: access, all, dir } = options;
            const functionRootPath = path_1.default.join(process.cwd(), config.functionRoot);
            const name = params === null || params === void 0 ? void 0 : params[0];
            if (access && (0, utils_1.checkFullAccess)(access)) {
                log.warn('--path 参数已更换为HTTP 访问服务路径，请使用 --dir 指定部署函数的文件夹路径');
            }
            if (access && access[0] !== '/') {
                throw new error_1.CloudBaseError('HTTP 访问服务路径必须以 / 开头');
            }
            if ((!name && !dir) || all) {
                return this.deployAllFunction({
                    all,
                    envId,
                    force,
                    access,
                    functions,
                    codeSecret,
                    functionRootPath
                });
            }
            if (dir) {
                (0, utils_1.checkFullAccess)(dir, true);
                if (!(0, utils_1.isDirectory)(dir)) {
                    throw new error_1.CloudBaseError('--dir 参数必须指定为云函数的文件夹路径');
                }
            }
            let newFunction;
            if (functions && functions.length > 0) {
                newFunction = functions.find((item) => item.name === name);
            }
            if (!newFunction || !newFunction.name) {
                log.info('未找到函数发布配置，使用默认配置 => 运行时：Nodejs10.15/在线安装依赖');
                newFunction = Object.assign({ name }, constant_1.DefaultFunctionDeployConfig);
            }
            const loading = (0, utils_1.loadingFactory)();
            loading.start('云函数部署中...');
            try {
                yield (0, function_1.createFunction)({
                    force,
                    envId,
                    codeSecret,
                    functionRootPath,
                    func: newFunction,
                    accessPath: access,
                    functionPath: dir
                });
                loading.succeed(`[${newFunction.name}] 云函数部署成功！`);
                this.printSuccessTips(envId);
            }
            catch (e) {
                loading.stop();
                yield this.handleDeployFail(e, {
                    envId,
                    codeSecret,
                    functionRootPath,
                    func: newFunction,
                    accessPath: access,
                    functionPath: dir
                });
            }
            if (access || newFunction.path) {
                const link = (0, utils_1.genClickableLink)(`https://${envId}.service.tcloudbase.com${access || newFunction.path}`);
                console.log(`\n云函数HTTP 访问服务访问链接：${link}`);
            }
        });
    }
    deployAllFunction(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { functions = [], envId, force, codeSecret, functionRootPath, all, access } = options;
            if (!all) {
                const { isBatch } = yield inquirer_1.default.prompt({
                    type: 'confirm',
                    name: 'isBatch',
                    message: '没有指定需要部署的云函数，是否部署配置文件中的全部云函数？',
                    default: false
                });
                if (!isBatch) {
                    throw new error_1.CloudBaseError('请指定需要部署的云函数的名称或通过 --path 参数指定需要部署的函数的路径！');
                }
            }
            const loading = (0, utils_1.loadingFactory)();
            const tasks = functions.map((func) => () => __awaiter(this, void 0, void 0, function* () {
                loading.start('云函数部署中');
                try {
                    yield (0, function_1.createFunction)({
                        func,
                        envId,
                        force,
                        codeSecret,
                        functionRootPath,
                        accessPath: access
                    });
                    loading.succeed(`[${func.name}] 云函数部署成功`);
                }
                catch (e) {
                    loading.stop();
                    yield this.handleDeployFail(e, {
                        func,
                        envId,
                        codeSecret,
                        functionRootPath,
                        accessPath: access
                    });
                }
            }));
            if (tasks.length > 5) {
                utils_1.logger.info('函数数量较多，将使用队列部署');
            }
            const asyncTaskController = new utils_1.AsyncTaskParallelController(5, 50);
            asyncTaskController.loadTasks(tasks);
            const results = yield asyncTaskController.run();
            const success = results.filter((_) => !_);
            utils_1.logger.success(`成功部署 ${success === null || success === void 0 ? void 0 : success.length} 个函数`);
            const err = results.filter((_) => _);
            (err === null || err === void 0 ? void 0 : err.length) && utils_1.logger.error(`${err === null || err === void 0 ? void 0 : err.length} 个云函数部署失败`);
        });
    }
    handleDeployFail(e, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { envId, codeSecret, functionRootPath, func, functionPath, accessPath } = options;
            const loading = (0, utils_1.loadingFactory)();
            if (e.code === 'ResourceInUse.FunctionName' || e.code === 'ResourceInUse.Function') {
                const { force } = yield inquirer_1.default.prompt({
                    type: 'confirm',
                    name: 'force',
                    message: `存在同名云函数：[${func.name}]，是否覆盖原函数代码与配置`,
                    default: false
                });
                const { triggers } = func;
                if (force) {
                    loading.start('云函数更新部署中...');
                    try {
                        yield (0, function_2.updateFunctionCode)({
                            func,
                            envId,
                            codeSecret,
                            functionRootPath
                        });
                        yield this.waitForFunctionReady(envId, func.name, loading);
                        loading.succeed(`[${func.name}] 云函数配置更新中...`);
                        yield (0, function_2.updateFunctionConfig)({
                            envId,
                            functionName: func.name,
                            config: func
                        });
                        loading.succeed(`[${func.name}] 云函数更新成功！`);
                        yield this.printSuccessTips(envId);
                    }
                    catch (e) {
                        loading.stop();
                        throw e;
                    }
                    return;
                }
            }
            throw e;
        });
    }
    waitForFunctionReady(envId, functionName, loading, timeoutMinutes = 5) {
        return __awaiter(this, void 0, void 0, function* () {
            const scfService = yield (0, function_2.getFunctionService)(envId);
            const timeoutMs = timeoutMinutes * 60 * 1000;
            return new Promise((resolve, reject) => {
                let intervalId = null;
                const timeoutId = setTimeout(() => {
                    clearInterval(intervalId);
                    reject(new error_1.CloudBaseError(`[${functionName}] 等待函数更新超时，已等待 ${timeoutMinutes} 分钟`));
                }, timeoutMs);
                intervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const functionInfo = yield scfService.getFunctionDetail(functionName);
                        if ((functionInfo === null || functionInfo === void 0 ? void 0 : functionInfo.Status) === 'Active') {
                            clearTimeout(timeoutId);
                            clearInterval(intervalId);
                            loading.succeed(`[${functionName}] 云函数代码已更新！`);
                            resolve();
                        }
                        else {
                            loading.text = `正在更新[${functionName}] 云函数代码... 当前状态: ${(functionInfo === null || functionInfo === void 0 ? void 0 : functionInfo.Status) || '未知'}`;
                        }
                    }
                    catch (error) {
                        loading.text = `获取[${functionName}] 云函数状态失败，重试中...`;
                    }
                }), 2000);
            });
        });
    }
    printSuccessTips(envId, log) {
        return __awaiter(this, void 0, void 0, function* () {
            let url = `https://console.cloud.tencent.com/tcb/scf?envId=${envId}`;
            const region = yield (0, toolbox_1.getRegion)();
            url += `&rid=${regionIdMap[region]}`;
            const link = (0, utils_1.genClickableLink)(url);
            log.breakLine();
            log.info(`控制台查看函数详情或创建HTTP 访问服务链接 🔗：${link}`);
            log.info(`使用 ${(0, utils_1.highlightCommand)('cloudbase functions:list')} 命令查看已部署云函数`);
        });
    }
    genApiGateway(envId, name) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const loading = (0, utils_1.loadingFactory)();
            const res = yield (0, gateway_1.queryGateway)({
                name,
                envId
            });
            if ((res === null || res === void 0 ? void 0 : res.EnableService) === false)
                return;
            loading.start('生成云函数HTTP 访问服务中...');
            let path;
            if (((_a = res === null || res === void 0 ? void 0 : res.APISet) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                path = (_b = res.APISet[0]) === null || _b === void 0 ? void 0 : _b.Path;
            }
            else {
                path = `/${(0, utils_1.random)(12)}`;
                yield (0, gateway_1.createGateway)({
                    envId,
                    name,
                    path
                });
            }
            loading.stop();
            const link = (0, utils_1.genClickableLink)(`https://${envId}.service.tcloudbase.com${path}`);
            console.log(`\n云函数HTTP 访问服务链接：${link}`);
        });
    }
};
__decorate([
    (0, decorators_1.InjectParams)(),
    __param(0, (0, decorators_1.CmdContext)()),
    __param(1, (0, decorators_1.ArgsParams)()),
    __param(2, (0, decorators_1.Log)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, decorators_1.Logger]),
    __metadata("design:returntype", Promise)
], FunctionDeploy.prototype, "execute", null);
__decorate([
    (0, decorators_1.InjectParams)(),
    __param(1, (0, decorators_1.Log)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, decorators_1.Logger]),
    __metadata("design:returntype", Promise)
], FunctionDeploy.prototype, "printSuccessTips", null);
FunctionDeploy = __decorate([
    (0, common_1.ICommand)()
], FunctionDeploy);
exports.FunctionDeploy = FunctionDeploy;
