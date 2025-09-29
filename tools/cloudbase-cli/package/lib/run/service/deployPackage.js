"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
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
exports.packageDeploy = void 0;
const path_1 = __importDefault(require("path"));
const fs = __importStar(require("fs"));
const __1 = require("..");
const toolbox_1 = require("@cloudbase/toolbox");
function packageDeploy(options) {
    return __awaiter(this, void 0, void 0, function* () {
        let { envId, serviceName, filePath, fileToIgnore } = options;
        let { PackageName, PackageVersion, UploadUrl, UploadHeaders } = yield (0, __1.createBuild)({
            envId,
            serviceName
        });
        const loading = (0, toolbox_1.loadingFactory)();
        const zipFile = `.tcbr_${serviceName}_${Date.now()}.zip`;
        const dstPath = path_1.default.join(process.cwd(), zipFile);
        try {
            if (fs.statSync(filePath).isDirectory()) {
                loading.start('正在压缩文件…');
                yield (0, toolbox_1.zipDir)(filePath, dstPath, fileToIgnore);
                loading.succeed('压缩文件完成');
            }
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new toolbox_1.CloudBaseError('找不到指定文件夹，请检查文件路径是否正确');
            }
            else {
                throw new toolbox_1.CloudBaseError(error.message);
            }
        }
        try {
            return yield (0, toolbox_1.execWithLoading)(() => __awaiter(this, void 0, void 0, function* () {
                yield (0, __1.uploadZip)(zipFile, UploadUrl, UploadHeaders[0]);
                return { PackageName, PackageVersion };
            }), {
                startTip: '\n正在上传代码包...',
                failTip: '上传代码包失败，请稍后重试'
            });
        }
        finally {
            yield fs.promises.unlink(dstPath);
        }
    });
}
exports.packageDeploy = packageDeploy;
