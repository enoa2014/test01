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
exports.downloadFunctionCode = void 0;
const utils_1 = require("../utils");
const common_1 = require("../utils/tools/common");
const scfService = utils_1.CloudApiService.getInstance('scf');
function downloadFunctionCode(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { destPath, envId, functionName, codeSecret } = options;
        (0, utils_1.checkFullAccess)(destPath, true);
        const { Url } = yield scfService.request('GetFunctionAddress', {
            FunctionName: functionName,
            Namespace: envId,
            CodeSecret: codeSecret
        });
        return (0, common_1.downloadAndExtractRemoteZip)(Url, destPath);
    });
}
exports.downloadFunctionCode = downloadFunctionCode;
