"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.outputHelpInfo = void 0;
const chalk_1 = __importDefault(require("chalk"));
const outputHelpInfo = () => {
    const commands = `
  命令
    ai             -- [cmd]                      开启 AI 全栈开发体验
    login             [options]                  登录腾讯云账号
    logout                                       登出腾讯云账号
    env               [cmd]                      环境管理操作
    fn                [cmd]                      操作函数
    hosting           [cmd]                      静态托管资源管理操作
    storage           [cmd]                      云存储资源管理操作
    service           [cmd]                      HTTP 访问服务管理操作
    cloudrun          [cmd]                      云托管服务管理操作`;
    const options = `
  选项

    --verbose                                  打印出内部运行信息
    -r, --region <region>                      指定环境地域
    --mode <mode>                              指定加载 env 文件的环境
    --config-file <path>                       指定配置文件路径
    -v, --version                              输出当前版本
    -h, --help                                 查看命令帮助信息`;
    const tips = `
  Tips:

    ${chalk_1.default.gray('–')} 登录

      ${chalk_1.default.cyan('$ tcb login')}

    ${chalk_1.default.gray('–')} 使用 AI 全栈开发部署

      ${chalk_1.default.cyan('$ tcb ai')}
`;
    console.log(commands, '\n', options, '\n', tips);
};
exports.outputHelpInfo = outputHelpInfo;
