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
exports.beaconAction = void 0;
const os_1 = __importDefault(require("os"));
const crypto_1 = __importDefault(require("crypto"));
const net_1 = require("./net");
class BeaconAction {
    constructor() {
        this.additionalParams = {};
        this.deviceId = this.getDeviceId();
        this.userAgent = this.getUserAgent();
    }
    getUserAgent() {
        const osType = os_1.default.type();
        const osRelease = os_1.default.release();
        const nodeVersion = process.version;
        const arch = os_1.default.arch();
        const cliVersion = require('../../package.json').version || 'unknown';
        return `Node/${nodeVersion} (${osType} ${osRelease}; ${arch}) CLI/${cliVersion}`;
    }
    getDeviceId() {
        const deviceInfo = [
            os_1.default.hostname(),
            os_1.default
                .cpus()
                .map((cpu) => cpu.model)
                .join(','),
            Object.values(os_1.default.networkInterfaces())
                .reduce((acc, val) => acc.concat(val), [])
                .filter((nic) => nic && !nic.internal && nic.mac)
                .map((nic) => nic.mac)
                .join(',')
        ].join('|');
        return crypto_1.default.createHash('sha256').update(deviceInfo).digest('hex').substring(0, 32);
    }
    report(eventCode, eventData = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = Date.now();
            return (0, net_1.postFetch)('https://otheve.beacon.qq.com/analytics/v2_upload', {
                appVersion: '',
                sdkId: 'js',
                sdkVersion: '4.5.14-web',
                mainAppKey: '0WEB0AD0GM4PUUU1',
                platformId: 3,
                common: {
                    A2: this.deviceId,
                    A101: this.userAgent,
                    from: 'tcb-cli',
                    xDeployEnv: process.env.NODE_ENV
                },
                events: [
                    {
                        eventCode,
                        eventTime: String(now),
                        mapValue: Object.assign(Object.assign({}, eventData), this.additionalParams)
                    }
                ]
            }).catch((e) => {
            });
        });
    }
    addAdditionalParams(params) {
        this.additionalParams = Object.assign(Object.assign({}, this.additionalParams), params);
    }
}
exports.beaconAction = new BeaconAction();
