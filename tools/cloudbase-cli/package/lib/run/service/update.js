"use strict";
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
exports.updateTcbrService = exports.updateCloudRunServer = void 0;
const toolbox_1 = require("@cloudbase/toolbox");
const inquirer_1 = __importDefault(require("inquirer"));
const __1 = require("..");
const utils_1 = require("../../utils");
const common_1 = require("./common");
const showLogs_1 = require("./showLogs");
function updateCloudRunServer(serviceConfigOptions) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const res = yield (0, utils_1.callTcbrApi)('UpdateCloudRunServer', serviceConfigOptions);
            return res;
        }
        catch (error) {
            console.log(error);
        }
    });
}
exports.updateCloudRunServer = updateCloudRunServer;
function updateTcbrService(options) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const { data: serviceDetail } = yield (0, __1.describeCloudRunServerDetail)({
            envId: options.envId,
            serviceName: options.serviceName
        });
        if (serviceDetail === undefined) {
            throw new toolbox_1.CloudBaseError(`当前服务不存在，请前往控制台 ${(0, utils_1.genClickableLink)('https://console.cloud.tencent.com/tcbr')} 创建服务`);
        }
        const status = yield (0, showLogs_1.getBuildStatus)(options.envId, options.serviceName);
        if (status === 'pending') {
            throw new toolbox_1.CloudBaseError('服务正在更新部署，请稍后再试，或查看实时部署日志');
        }
        const previousServerConfig = serviceDetail === null || serviceDetail === void 0 ? void 0 : serviceDetail.ServerConfig;
        const newServiceOptions = yield (0, common_1.tcbrServiceOptions)(options, true, true, previousServerConfig);
        if (!options.noConfirm) {
            const { confirm } = yield inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: '确定要更新服务吗？',
                }
            ]);
            if (!confirm) {
                return;
            }
        }
        const updateRes = yield updateCloudRunServer(newServiceOptions);
        if (updateRes instanceof Error) {
            throw new toolbox_1.CloudBaseError('当前已有部署发布任务运行中，请稍后再试，或查看实时部署日志');
        }
        const taskId = (_a = updateRes.data) === null || _a === void 0 ? void 0 : _a.TaskId;
        if (options.json) {
            console.log(JSON.stringify(updateRes, null, 2));
        }
        if (process.argv.includes('--verbose')) {
            yield (0, showLogs_1.getLogs)({
                envId: options.envId,
                taskId,
                serviceName: options.serviceName
            });
            console.log(`本次任务的 TaskID： ${taskId}`);
        }
        else {
            toolbox_1.logger.success('更新服务成功, 本次任务的 TaskID: ' + taskId);
        }
    });
}
exports.updateTcbrService = updateTcbrService;
