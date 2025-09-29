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
exports.EnvLocalManager = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const error_1 = require("../../error");
const dotenvx = __importStar(require("@dotenvx/dotenvx"));
const const_1 = require("./const");
dotenvx.setLogLevel({
    logLevel: 'error'
});
class EnvLocalManager {
    updateEnvId(envId) {
        this.setEnvLocal('ENV_ID', envId);
    }
    parseEnvFile() {
        return __awaiter(this, void 0, void 0, function* () {
            const content = yield fs_extra_1.default.readFile(const_1.ENV_LOCAL_PATH, 'utf8');
            return dotenvx.parse(content);
        });
    }
    updateAIConfig(aiConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.addAIConfigToEnv(aiConfig);
            }
            catch (error) {
                throw new error_1.CloudBaseError(`更新 AI 配置失败: ${error.message}`, { original: error });
            }
        });
    }
    removeAIConfig(agentName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const envMap = yield this.parseEnvFile();
                if (agentName) {
                    this.removeSpecificAgentConfig(envMap, agentName);
                }
                else {
                    this.removeAIConfigFromMap(envMap);
                }
            }
            catch (error) {
                throw new error_1.CloudBaseError(`移除 AI 配置失败: ${error.message}`, { original: error });
            }
        });
    }
    validateAIConfig(aiConfig) {
        const errors = [];
        if (!aiConfig.defaultAgent) {
            errors.push('默认 AI 工具不能为空');
        }
        Object.entries(aiConfig.agents).forEach(([agentName, config]) => {
            if (!config.apiKey) {
                errors.push(`${agentName} 必须配置 API Key`);
            }
            if (config.baseUrl && !isValidUrl(config.baseUrl)) {
                errors.push(`${agentName} 的 Base URL 格式不正确`);
            }
        });
        return errors;
    }
    updateDefaultAgent(agent) {
        this.setEnvLocal('AI_DEFAULT_AGENT', agent);
    }
    setEnvLocal(key, value) {
        dotenvx.set(key, value, { path: const_1.ENV_LOCAL_PATH, encrypt: false });
    }
    removeEnvLocal(key) {
        dotenvx.set(key, '', { path: const_1.ENV_LOCAL_PATH, encrypt: false });
    }
    removeAIConfigFromMap(envMap) {
        Object.keys(envMap)
            .filter((x) => x.startsWith('AI_'))
            .forEach((x) => this.removeEnvLocal(x));
    }
    removeSpecificAgentConfig(envMap, agentName) {
        const agentPrefix = `AI_${agentName.toUpperCase()}_`;
        Object.keys(envMap)
            .filter((x) => x.startsWith(agentPrefix))
            .forEach((x) => this.removeEnvLocal(x));
    }
    addAIConfigToEnv(aiConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            this.setEnvLocal('AI_DEFAULT_AGENT', aiConfig.defaultAgent);
            Object.entries(aiConfig.agents).forEach(([agentName, agentConfig]) => {
                const upperAgentName = agentName.toUpperCase();
                if (agentConfig.apiKey) {
                    this.setEnvLocal(`AI_${upperAgentName}_API_KEY`, agentConfig.apiKey);
                }
                if (agentConfig.baseUrl) {
                    this.setEnvLocal(`AI_${upperAgentName}_BASE_URL`, agentConfig.baseUrl);
                }
                if (agentConfig.model) {
                    this.setEnvLocal(`AI_${upperAgentName}_MODEL`, agentConfig.model);
                }
            });
        });
    }
}
exports.EnvLocalManager = EnvLocalManager;
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    }
    catch (_a) {
        return false;
    }
}
