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
exports.callTcbrApi = void 0;
const toolbox_1 = require("@cloudbase/toolbox");
const net_1 = require("../net");
const tcbrService = net_1.CloudApiService.getInstance('tcbr');
function callTcbrApi(action, data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const res = yield tcbrService.request(action, data);
            return {
                code: 0,
                errmsg: 'success',
                data: Object.assign({}, res)
            };
        }
        catch (e) {
            if (e.code === 'AuthFailure.UnauthorizedOperation') {
                console.log('\n', `requestId: ${e.requestId}`);
                throw new toolbox_1.CloudBaseError('您没有权限执行此操作，请检查 CAM 策略\n');
            }
            else if (e.code === 'LimitExceeded') {
                throw new toolbox_1.CloudBaseError(`${e.original.Message}\n`);
            }
            return e;
        }
    });
}
exports.callTcbrApi = callTcbrApi;
