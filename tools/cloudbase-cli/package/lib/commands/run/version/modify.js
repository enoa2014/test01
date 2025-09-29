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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModifyVersion = void 0;
const common_1 = require("../../common");
const error_1 = require("../../../error");
const run_1 = require("../../../run");
const utils_1 = require("../../../utils");
const decorators_1 = require("../../../decorators");
const common_2 = require("./common");
const modifyByFlow = (envId, serviceName, mode) => __awaiter(void 0, void 0, void 0, function* () {
    const versionFlowItems = [];
    const loading = (0, utils_1.loadingFactory)();
    mode.split('|')[1]
        .split('&')
        .forEach((item) => {
        versionFlowItems.push({
            VersionName: item.split('=')[0],
            FlowRatio: Number(item.split('=')[1])
        });
    });
    let sum = versionFlowItems.reduce((sum, item) => sum + item.FlowRatio, 0);
    if (sum !== 100 && sum !== 0)
        throw new error_1.CloudBaseError('流量配置的总和需要为 0 或 100');
    loading.start('数据加载中...');
    const res = yield (0, run_1.modifyVersion)({
        envId,
        serverName: serviceName,
        trafficType: 'FLOW',
        versionFlowItems
    });
    if (res !== 'succ')
        throw new error_1.CloudBaseError('分配失败');
    loading.succeed('分配成功');
});
const modifyByURL = (envId, serviceName, mode) => __awaiter(void 0, void 0, void 0, function* () {
    const versionFlowItems = [];
    const loading = (0, utils_1.loadingFactory)();
    mode.split('|')[1]
        .split('&')
        .forEach((item, index) => {
        versionFlowItems.push({
            VersionName: item.split(',')[2],
            FlowRatio: 0,
            Priority: index + 1,
            IsDefaultPriority: false,
            UrlParam: {
                Key: item.split(',')[0],
                Value: item.split(',')[1]
            }
        });
    });
    if (!versionFlowItems.some((item) => item.VersionName === mode.split('|')[2])) {
        versionFlowItems.push({
            VersionName: mode.split('|')[2],
            FlowRatio: 0,
            IsDefaultPriority: true
        });
    }
    else {
        versionFlowItems.find((item) => item.VersionName === mode.split('|')[2]).IsDefaultPriority = true;
    }
    loading.start('数据加载中...');
    const res = yield (0, run_1.modifyVersion)({
        envId,
        serverName: serviceName,
        trafficType: 'URL_PARAMS',
        versionFlowItems
    });
    if (res !== 'succ')
        throw new error_1.CloudBaseError('分配失败');
    loading.succeed('分配成功');
});
let ModifyVersion = class ModifyVersion extends common_1.Command {
    get options() {
        return Object.assign(Object.assign({}, (0, common_2.versionCommonOptions)('modify')), { options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                },
                {
                    flags: '-s, --serviceName <serviceName>',
                    desc: '托管服务 name'
                },
                {
                    flags: '-t, --traffic <traffic>',
                    desc: '配置 type，按百分比分配即为FLOW|versionName1=a&...&versionName1=b，按URL分配则是URL|key1,value1,version1&...&key1,value1,version1|defaultVersion'
                }
            ], desc: '展示选择的云托管服务的版本列表' });
    }
    execute(envId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let envCheckType = yield (0, utils_1.checkTcbrEnv)(options.envId, false);
            if (envCheckType !== 0) {
                (0, utils_1.logEnvCheck)(envId, envCheckType);
                return;
            }
            let { serviceName = '', traffic: _traffic = 'FLOW' } = options;
            if (serviceName.length === 0)
                throw new error_1.CloudBaseError('请填入有效云托管服务名');
            if (_traffic.split('|')[0] === 'URL') {
                modifyByURL(envId, serviceName, _traffic);
            }
            else {
                modifyByFlow(envId, serviceName, _traffic);
            }
        });
    }
};
__decorate([
    (0, decorators_1.InjectParams)(),
    __param(0, (0, decorators_1.EnvId)()),
    __param(1, (0, decorators_1.ArgsOptions)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ModifyVersion.prototype, "execute", null);
ModifyVersion = __decorate([
    (0, common_1.ICommand)()
], ModifyVersion);
exports.ModifyVersion = ModifyVersion;
