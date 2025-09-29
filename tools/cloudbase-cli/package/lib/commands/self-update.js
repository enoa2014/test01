"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
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
exports.RollbackCommand = exports.SelfUpdateCommand = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const common_1 = require("./common");
const error_1 = require("../error");
const child_process_1 = require("child_process");
let SelfUpdateCommand = class SelfUpdateCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'self-update',
            desc: '更新当前 CloudBase CLI（独立发行版）到指定或最新版本',
            requiredEnvId: false,
            withoutAuth: true,
            options: [
                { flags: '--version <version>', desc: '指定版本号，缺省为最新' },
                { flags: '--channel <channel>', desc: '渠道：stable|beta，默认 stable' },
                { flags: '--download-base <url>', desc: '下载基址，默认 https://static.cloudbase.net/cli' }
            ]
        };
    }
    execute(ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            const version = ctx.options.version || 'latest';
            const channel = ctx.options.channel || 'stable';
            const base = ctx.options.downloadBase || process.env.DOWNLOAD_BASE || 'https://static.cloudbase.net/cli';
            const home = os_1.default.homedir();
            const root = path_1.default.join(home, '.local/share/cloudbase-cli');
            const installer = path_1.default.join(root, 'current', 'install.sh');
            let installerCmd;
            try {
                if (fs_1.default.existsSync(installer)) {
                    installerCmd = `${installer}`;
                }
                else {
                    installerCmd = `bash -c "curl -fsSL ${base}/install | bash"`;
                }
                const env = [
                    `DOWNLOAD_BASE=${base}`,
                    `CHANNEL=${channel}`,
                    `VERSION=${version}`
                ].join(' ');
                (0, child_process_1.execSync)(`${env} ${installerCmd}`, { stdio: 'inherit' });
            }
            catch (e) {
                throw new error_1.CloudBaseError(`自更新失败：${(e === null || e === void 0 ? void 0 : e.message) || e}`);
            }
        });
    }
};
SelfUpdateCommand = __decorate([
    (0, common_1.ICommand)()
], SelfUpdateCommand);
exports.SelfUpdateCommand = SelfUpdateCommand;
let RollbackCommand = class RollbackCommand extends common_1.Command {
    get options() {
        return {
            cmd: 'rollback',
            desc: '回滚 CloudBase CLI（独立发行版）到上一版本',
            requiredEnvId: false,
            withoutAuth: true,
            options: []
        };
    }
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            const home = os_1.default.homedir();
            const root = path_1.default.join(home, '.local/share/cloudbase-cli');
            const versionsDir = path_1.default.join(root, 'versions');
            if (!fs_1.default.existsSync(versionsDir)) {
                throw new error_1.CloudBaseError('未找到已安装版本目录，无法回滚');
            }
            const entries = fs_1.default.readdirSync(versionsDir)
                .filter((n) => !n.startsWith('.') && fs_1.default.statSync(path_1.default.join(versionsDir, n)).isDirectory())
                .sort();
            if (entries.length < 2) {
                throw new error_1.CloudBaseError('没有可回滚的历史版本');
            }
            const target = entries[entries.length - 2];
            const currentLink = path_1.default.join(root, 'current');
            try {
                const binDir = path_1.default.join(os_1.default.homedir(), '.local/bin');
                const targetDir = path_1.default.join(versionsDir, target);
                const map = [
                    ['cloudbase', 'bin/cloudbase'],
                    ['tcb', 'bin/tcb'],
                    ['cloudbase-mcp', 'bin/cloudbase-mcp']
                ];
                for (const [name, rel] of map) {
                    const link = path_1.default.join(binDir, name);
                    try {
                        fs_1.default.unlinkSync(link);
                    }
                    catch (_) { }
                    fs_1.default.symlinkSync(path_1.default.join(targetDir, rel), link);
                }
                try {
                    fs_1.default.unlinkSync(currentLink);
                }
                catch (_) { }
                fs_1.default.symlinkSync(targetDir, currentLink);
                console.log(`已回滚到版本: ${target}`);
            }
            catch (e) {
                throw new error_1.CloudBaseError(`回滚失败：${(e === null || e === void 0 ? void 0 : e.message) || e}`);
            }
        });
    }
};
RollbackCommand = __decorate([
    (0, common_1.ICommand)()
], RollbackCommand);
exports.RollbackCommand = RollbackCommand;
