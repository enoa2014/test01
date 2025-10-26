'use strict'
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, '__esModule', { value: true })
exports.debugLogger = void 0
const chalk_1 = __importDefault(require('chalk'))
const fs_1 = __importDefault(require('fs'))
function debugLogger(req, resp, startTime, endTime, writeToLocal = true) {
    if (process.env.NODE_ENV !== 'DEBUG') {
        return
    }
    const cost = endTime.valueOf() - startTime.valueOf()
    const startTimeFormatted = startTime.toISOString()
    const endTimeFormatted = endTime.toISOString()
    console.log(chalk_1.default.underline('\n[DEBUG]', startTimeFormatted))
    console.log(chalk_1.default.cyan(JSON.stringify(req)), '\n')
    console.log(chalk_1.default.underline('[DEBUG]', endTimeFormatted))
    console.log(chalk_1.default.magenta(JSON.stringify(resp)), '\n')
    if (writeToLocal) {
        const filePath = `${process.cwd()}/cloudbase-cli.debug.log`
        const logContent = `\n{start:${startTimeFormatted}, req: ${JSON.stringify(req)}, end:${endTimeFormatted}, resp: ${JSON.stringify(resp)}, cost: ${cost}}`
        fs_1.default.appendFile(filePath, logContent, (err) => {
            if (err) {
                console.error(chalk_1.default.red(`\n写入日志失败：${JSON.stringify(err)}`))
            }
        })
    }
}
exports.debugLogger = debugLogger
