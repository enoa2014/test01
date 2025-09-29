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
exports.getFunctionAliasConfig = exports.setFunctionAliasConfig = void 0;
const error_1 = require("../error");
const base_1 = require("./base");
function setFunctionAliasConfig(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { envId, functionName, name, functionVersion, description, routingConfig } = options;
        const scfService = yield (0, base_1.getFunctionService)(envId);
        try {
            yield scfService.updateFunctionAliasConfig({
                functionName,
                name,
                functionVersion,
                description,
                routingConfig
            });
        }
        catch (e) {
            throw new error_1.CloudBaseError(`[${functionName}] 设置函数流量配置失败： ${e.message}`, {
                code: e.code
            });
        }
    });
}
exports.setFunctionAliasConfig = setFunctionAliasConfig;
function getFunctionAliasConfig(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { envId, functionName, name } = options;
        const scfService = yield (0, base_1.getFunctionService)(envId);
        try {
            return scfService.getFunctionAlias({
                functionName,
                name
            });
        }
        catch (e) {
            throw new error_1.CloudBaseError(`[${functionName}] 查询函数别名配置失败： ${e.message}`, {
                code: e.code
            });
        }
    });
}
exports.getFunctionAliasConfig = getFunctionAliasConfig;
