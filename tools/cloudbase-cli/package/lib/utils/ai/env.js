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
exports.ensureValidEnv = void 0;
const env_1 = require("../../env");
const constants_1 = require("../../commands/constants");
const utils_1 = require("../../commands/utils");
const config_1 = require("./config");
function ensureValidEnv(_envId, log) {
    return __awaiter(this, void 0, void 0, function* () {
        const envs = yield (0, env_1.listEnvs)({ source: [constants_1.EnvSource.MINIAPP, constants_1.EnvSource.QCLOUD] });
        const validEnv = envs.find((env) => env.EnvId === _envId);
        if (!validEnv) {
            log.error(`❌ 环境 ${_envId} 与当前账号不匹配，请重新选择`);
            const envId = yield (0, utils_1.selectEnv)({ source: [constants_1.EnvSource.MINIAPP, constants_1.EnvSource.QCLOUD] });
            new config_1.AIConfigManager().updateEnvId(envId);
            return envId;
        }
        if (validEnv.Status !== constants_1.EnvStatus.NORMAL) {
            log.error(`❌ 环境 ${_envId} 不可用，请重新选择`);
            const envId = yield (0, utils_1.selectEnv)({ source: [constants_1.EnvSource.MINIAPP, constants_1.EnvSource.QCLOUD] });
            new config_1.AIConfigManager().updateEnvId(envId);
            return envId;
        }
        return _envId;
    });
}
exports.ensureValidEnv = ensureValidEnv;
