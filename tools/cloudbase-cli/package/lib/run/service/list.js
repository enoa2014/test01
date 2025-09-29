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
Object.defineProperty(exports, "__esModule", { value: true });
exports.listService = void 0;
const utils_1 = require("../../utils");
const tcbService = utils_1.CloudApiService.getInstance('tcb');
const listService = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const { data: { ServerList: serverList } } = yield (0, utils_1.callTcbrApi)('DescribeCloudRunServers', {
        EnvId: options.envId,
    });
    const { CloudBaseRunServerSet: serverSet } = yield tcbService.request('DescribeCloudBaseRunServers', {
        EnvId: options.envId,
        Offset: 0,
        Limit: options.limit || 100
    });
    if (!serverList.length)
        return [];
    const serverInfo = serverList.map(serverItem => {
        return Object.assign(Object.assign({}, serverItem), { CreatedTime: serverSet.find((item) => item.ServerName === serverItem.ServerName).CreatedTime });
    });
    return serverInfo;
});
exports.listService = listService;
