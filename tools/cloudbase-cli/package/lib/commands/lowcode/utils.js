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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMergedOptions = exports.getCmdConfig = exports.getLowcodeCli = exports.promisifyProcess = void 0;
const lodash_1 = require("lodash");
const toolbox_1 = require("@cloudbase/toolbox");
function promisifyProcess(p, pipe = false) {
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        p.stdout.on('data', (data) => {
            stdout += String(data);
        });
        p.stderr.on('data', (data) => {
            stderr += String(data);
        });
        p.on('error', reject);
        p.on('exit', (exitCode) => {
            exitCode === 0
                ? resolve(stdout)
                : reject(new toolbox_1.CloudBaseError(stderr || String(exitCode)));
        });
        if (pipe) {
            p.stdout.pipe(process.stdout);
            p.stderr.pipe(process.stderr);
        }
    });
}
exports.promisifyProcess = promisifyProcess;
function getLowcodeCli() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const key = '@cloudbase/lowcode-cli';
        const cache = new Map();
        let result;
        if (!cache.get(key)) {
            const module = yield (_a = key, Promise.resolve().then(() => __importStar(require(_a))));
            cache.set(key, module);
        }
        result = cache.get(key);
        return result;
    });
}
exports.getLowcodeCli = getLowcodeCli;
function getCmdConfig(config, options) {
    return (0, lodash_1.get)(config, `${options.cmd}["${options.childCmd}"]`);
}
exports.getCmdConfig = getCmdConfig;
function getMergedOptions(config = {}, argOptions = {}) {
    return (0, lodash_1.merge)({}, config.inputs || {}, argOptions);
}
exports.getMergedOptions = getMergedOptions;
