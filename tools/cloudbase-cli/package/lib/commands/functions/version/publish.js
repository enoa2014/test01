"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
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
exports.PublishFunctionVersion = void 0;
const common_1 = require("../../common");
const utils_1 = require("../../../utils");
const function_1 = require("../../../function");
const decorators_1 = require("../../../decorators");
let PublishFunctionVersion = class PublishFunctionVersion extends common_1.Command {
    get options() {
        return {
            cmd: 'fn',
            childCmd: 'publish-version <name> [description]',
            options: [
                {
                    flags: '-e, --envId <envId>',
                    desc: '环境 Id'
                }
            ],
            desc: '发布函数新版本'
        };
    }
    execute(ctx, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const name = params === null || params === void 0 ? void 0 : params[0];
            const description = params === null || params === void 0 ? void 0 : params[1];
            const { envId } = ctx;
            const loading = (0, utils_1.loadingFactory)();
            loading.start(`发布函数 [${name}] 新版本中...`);
            yield (0, function_1.publishVersion)({
                envId,
                functionName: name,
                description
            });
            loading.succeed(`发布函数 [${name}] 新版本成功！`);
        });
    }
};
__decorate([
    (0, decorators_1.InjectParams)(),
    __param(0, (0, decorators_1.CmdContext)()),
    __param(1, (0, decorators_1.ArgsParams)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PublishFunctionVersion.prototype, "execute", null);
PublishFunctionVersion = __decorate([
    (0, common_1.ICommand)()
], PublishFunctionVersion);
exports.PublishFunctionVersion = PublishFunctionVersion;
