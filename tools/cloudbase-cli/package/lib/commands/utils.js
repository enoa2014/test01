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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCloudbaserc = exports.upsertCloudbaserc = exports.rawFetchAccessToken = exports.fetchAccessToken = exports.getCredential = exports.trackCallback = exports.isDirectoryEmptyOrNotExists = exports.getPackageJsonName = exports.selectEnv = void 0;
const fs_1 = require("@cloudbase/iac-core/lib/src/fs");
const signature_nodejs_1 = require("@cloudbase/signature-nodejs");
const fs_extra_1 = require("fs-extra");
const inquirer_1 = __importDefault(require("inquirer"));
const lodash_1 = require("lodash");
const node_fetch_1 = __importDefault(require("node-fetch"));
const path_1 = __importDefault(require("path"));
const env_1 = require("../env");
const utils_1 = require("../utils");
const constants_1 = require("./constants");
function selectEnv(options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const loading = (0, utils_1.loadingFactory)();
        const { source = [] } = options;
        loading.start('获取环境列表中...');
        let data = yield (0, env_1.listEnvs)({ source }).finally(() => {
            loading.stop();
        });
        const choices = (0, lodash_1.sortBy)(data, ['Alias']).map((item) => {
            return {
                name: `${item.Alias || item.EnvId} (${item.EnvId}) ${item.Status === constants_1.EnvStatus.NORMAL ? '正常' : '不可用'}`,
                value: item.EnvId
            };
        });
        const questions = [
            {
                type: 'list',
                name: 'env',
                message: '请选择环境',
                choices: choices
            }
        ];
        const answers = yield inquirer_1.default.prompt(questions);
        return answers['env'];
    });
}
exports.selectEnv = selectEnv;
function getPackageJsonName(pkgPath) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const pkg = yield (0, fs_1.safeReadJSON)(pkgPath);
        const parts = ((_a = pkg.name) === null || _a === void 0 ? void 0 : _a.split('/')) || [];
        const pkgName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
        return {
            fullName: pkg.name,
            shortName: pkgName
        };
    });
}
exports.getPackageJsonName = getPackageJsonName;
function isDirectoryEmptyOrNotExists(dirPath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const exists = yield (0, fs_extra_1.pathExists)(dirPath);
            if (!exists) {
                return true;
            }
            const files = yield (0, fs_extra_1.readdir)(dirPath);
            return files.length === 0;
        }
        catch (error) {
            return true;
        }
    });
}
exports.isDirectoryEmptyOrNotExists = isDirectoryEmptyOrNotExists;
function trackCallback(message, log) {
    if (message.type === 'error') {
        log.error(message.details);
    }
    else {
        log.info(message.details);
    }
}
exports.trackCallback = trackCallback;
function getCredential(ctx, options) {
    return __awaiter(this, void 0, void 0, function* () {
        let credential;
        if (ctx.hasPrivateSettings) {
            process.env.IS_PRIVATE = 'true';
            const privateSettings = (0, utils_1.getPrivateSettings)(ctx.config, options.cmd);
            credential = privateSettings === null || privateSettings === void 0 ? void 0 : privateSettings.credential;
        }
        else {
            credential = yield utils_1.authSupevisor.getLoginState();
        }
        return credential;
    });
}
exports.getCredential = getCredential;
function fetchAccessToken(params) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield rawFetchAccessToken(params);
        return result === null || result === void 0 ? void 0 : result.access_token;
    });
}
exports.fetchAccessToken = fetchAccessToken;
function rawFetchAccessToken(params) {
    return __awaiter(this, void 0, void 0, function* () {
        const { envId, secretId, secretKey, token } = params;
        const domain = `${envId}.api.tcloudbasegateway.com`;
        const url = `https://${domain}/auth/v1/token/clientCredential`;
        const method = 'POST';
        const body = {
            grant_type: 'client_credentials'
        };
        const now = Date.now();
        const requiredHeaders = {
            Host: domain,
            'Content-Type': 'application/json'
        };
        const { authorization, timestamp } = (0, signature_nodejs_1.sign)({
            secretId,
            secretKey,
            method,
            url,
            params: body,
            headers: requiredHeaders,
            timestamp: Math.floor(now / 1000) - 1,
            withSignedParams: false,
            isCloudApi: true
        });
        const tokenResponse = yield (0, node_fetch_1.default)(url, {
            method,
            headers: Object.assign(Object.assign({}, requiredHeaders), { Authorization: `${authorization}, Timestamp=${timestamp}, Token=${token}` }),
            body: JSON.stringify(body)
        });
        return tokenResponse.json();
    });
}
exports.rawFetchAccessToken = rawFetchAccessToken;
function upsertCloudbaserc(projectPath, inputData) {
    return __awaiter(this, void 0, void 0, function* () {
        const { envId } = inputData, rest = __rest(inputData, ["envId"]);
        const configPath = path_1.default.resolve(projectPath, 'cloudbaserc.json');
        const defaultConfig = {
            version: '2.0',
            envId: envId || '{{envId}}',
            $schema: 'https://framework-1258016615.tcloudbaseapp.com/schema/latest.json'
        };
        try {
            const fileExists = yield (0, fs_extra_1.pathExists)(configPath);
            if (!fileExists) {
                const initialConfig = Object.assign(Object.assign({}, defaultConfig), rest);
                yield (0, fs_extra_1.writeJson)(configPath, initialConfig, { spaces: 2 });
                return;
            }
            const existingConfig = yield (0, fs_extra_1.readJson)(configPath);
            const mergedConfig = (0, lodash_1.merge)(existingConfig, inputData);
            yield (0, fs_extra_1.writeJson)(configPath, mergedConfig, { spaces: 2 });
        }
        catch (error) {
            throw new Error(`更新 cloudbaserc.json 失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
exports.upsertCloudbaserc = upsertCloudbaserc;
function getCloudbaserc(projectPath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield (0, utils_1.getCloudBaseConfig)(path_1.default.resolve(projectPath, 'cloudbaserc.json'));
        }
        catch (e) {
            return {};
        }
    });
}
exports.getCloudbaserc = getCloudbaserc;
