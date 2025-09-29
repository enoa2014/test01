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
exports.checkLogin = exports.login = exports.loginWithKey = exports.loginByWebAuth = void 0;
const lodash_1 = __importDefault(require("lodash"));
const utils_1 = require("../utils");
const decorators_1 = require("../decorators");
const env_1 = require("../env");
const log = new decorators_1.Logger();
const LoginRes = {
    SUCCESS: {
        code: 'SUCCESS',
        msg: '登录成功！'
    },
    INVALID_TOKEN: {
        code: 'INVALID_TOKEN',
        msg: '无效的身份信息！'
    },
    CHECK_LOGIN_FAILED: {
        code: 'CHECK_LOGIN_FAILED',
        msg: '检查登录态失败'
    },
    INVALID_PARAM(msg) {
        return {
            code: 'INVALID_PARAM',
            msg: `参数无效：${msg}`
        };
    }
};
function loginByWebAuth() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const credential = yield utils_1.authSupevisor.loginByWebAuth();
            if (lodash_1.default.isEmpty(credential)) {
                return LoginRes.INVALID_TOKEN;
            }
            return Object.assign({ credential }, LoginRes.SUCCESS);
        }
        catch (error) {
            console.error('Web 授权登录失败，可能是环境兼容性问题');
            console.error('建议使用密钥登录：tcb login --key');
            console.error('详细说明请参考：https://docs.cloudbase.net/cli-v1/login#%E8%85%BE%E8%AE%AF%E4%BA%91-%E4%BA%91%E5%BC%80%E5%8F%91%E6%8E%A7%E5%88%B6%E5%8F%B0%E6%8E%88%E6%9D%83');
            return {
                code: 'WEB_AUTH_FAILED',
                msg: 'Web 授权登录失败，请使用密钥登录：tcb login --key',
                error: error.message
            };
        }
    });
}
exports.loginByWebAuth = loginByWebAuth;
function loginWithKey(secretId, secretKey, token) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!secretId || !secretKey) {
            return LoginRes.INVALID_PARAM('SecretID 或 SecretKey 不能为空');
        }
        const credential = yield utils_1.authSupevisor.loginByApiSecret(secretId, secretKey, token);
        if (lodash_1.default.isEmpty(credential)) {
            return LoginRes.INVALID_TOKEN;
        }
        return LoginRes.SUCCESS;
    });
}
exports.loginWithKey = loginWithKey;
function login(options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const { secretId, secretKey, key, token } = options;
        return key ? loginWithKey(secretId, secretKey, token) : loginByWebAuth();
    });
}
exports.login = login;
function checkLogin() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const credential = yield (0, utils_1.checkAndGetCredential)();
        if (lodash_1.default.isEmpty(credential)) {
            log.info('你还没有登录，请在控制台中授权登录');
            const res = yield (0, utils_1.execWithLoading)(() => login(), {
                startTip: '请在浏览器中打开的授权页面进行授权...',
                successTip: '授权登录成功！'
            });
            const envId = (_a = res === null || res === void 0 ? void 0 : res.credential) === null || _a === void 0 ? void 0 : _a.envId;
            if (envId) {
                const env = yield (0, env_1.getEnvInfo)(envId);
                if (env.Status === "UNAVAILABLE") {
                    yield (0, utils_1.checkEnvAvaliable)(envId);
                }
            }
        }
    });
}
exports.checkLogin = checkLogin;
