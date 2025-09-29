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
exports.ensureFiles = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const const_1 = require("./const");
function ensureFiles() {
    return __awaiter(this, void 0, void 0, function* () {
        yield fs_extra_1.default.ensureFile(const_1.ENV_LOCAL_PATH);
        if (!(yield fs_extra_1.default.exists(const_1.CONFIG_PATH))) {
            yield fs_extra_1.default.writeFile(const_1.CONFIG_PATH, const_1.DEFAULT_CONFIG);
        }
        yield fs_extra_1.default.ensureDir(const_1.CLAUDE_CODE_ROUTER_LOGS_DIR_PATH);
    });
}
exports.ensureFiles = ensureFiles;
