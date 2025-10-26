'use strict'
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, '__esModule', { value: true })
exports.ensureNodeVersion = void 0
const semver_1 = __importDefault(require('semver'))
function ensureNodeVersion(version, log) {
    const result = semver_1.default.compare(process.version, version)
    if (result < 0) {
        log.error(`当前 Node.js 版本为 ${process.version}。请升级到至少 ${version} 版本。`)
        process.exit(1)
    }
}
exports.ensureNodeVersion = ensureNodeVersion
