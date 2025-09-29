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
exports.ListServiceTcbr = void 0;
const common_1 = require("../../common");
const decorators_1 = require("../../../decorators");
const run_1 = require("../../../run");
const utils_1 = require("../../../utils");
const checkTcbrEnv_1 = require("../../../utils/checkTcbrEnv");
let ListServiceTcbr = class ListServiceTcbr extends common_1.Command {
    get options() {
        return {
            cmd: 'run',
            childCmd: 'service:list',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                },
                {
                    flags: '-s, --serviceName <serviceName>',
                    desc: '服务名'
                },
                {
                    flags: '--json',
                    desc: '以 JSON 形式展示结果'
                }
            ],
            desc: '展示环境下服务信息'
        };
    }
    execute(options) {
        return __awaiter(this, void 0, void 0, function* () {
            let { envId, serviceName = '' } = options;
            let envCheckType = yield (0, checkTcbrEnv_1.checkTcbrEnv)(envId, true);
            if (envCheckType !== 0) {
                (0, checkTcbrEnv_1.logEnvCheck)(envId, envCheckType);
                return;
            }
            const loading = (0, utils_1.loadingFactory)();
            const head = ['服务名称', '状态', '公网访问', '创建时间', '更新时间'];
            loading.start('正在获取服务列表');
            const serverList = yield (0, run_1.listService)({
                envId: envId
            });
            loading.stop();
            const specificServer = serverList.filter(serverItem => serverItem.ServerName === serviceName);
            if (options.json) {
                console.log(JSON.stringify({
                    code: 0,
                    errmsg: 'success',
                    data: specificServer.length ?
                        specificServer
                        : serverList
                }, null, 2));
                return;
            }
            if (!serverList.length) {
                console.log('当前环境下没有服务');
                return;
            }
            let tableData;
            if (specificServer.length) {
                tableData = [[
                        specificServer[0].ServerName,
                        specificServer[0].Status,
                        `是 ${(0, utils_1.genClickableLink)(specificServer[0].DefaultDomainName)}`,
                        specificServer[0].CreatedTime,
                        specificServer[0].UpdateTime
                    ]];
            }
            else {
                tableData = serverList.map(serverItem => [
                    serverItem.ServerName,
                    serverItem.Status,
                    `是 ${(0, utils_1.genClickableLink)(serverItem.DefaultDomainName)}`,
                    serverItem.CreatedTime,
                    serverItem.UpdateTime
                ]);
            }
            (0, utils_1.printHorizontalTable)(head, tableData);
        });
    }
};
__decorate([
    (0, decorators_1.InjectParams)(),
    __param(0, (0, decorators_1.ArgsOptions)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ListServiceTcbr.prototype, "execute", null);
ListServiceTcbr = __decorate([
    (0, common_1.ICommand)()
], ListServiceTcbr);
exports.ListServiceTcbr = ListServiceTcbr;
