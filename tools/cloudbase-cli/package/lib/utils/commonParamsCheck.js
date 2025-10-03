'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.parseInputParam = exports.parseOptionalParams = void 0
const error_1 = require('../error')
const run_1 = require('../run')
const validator_1 = require('./validator')
function parseOptionalParams(options) {
    let cpuConverted
    let memConverted
    if (options.cpu || options.mem) {
        let data = (0, validator_1.validateCpuMem)(options.cpu, options.mem)
        ;[cpuConverted, memConverted] = [data.cpuOutput, data.memOutput]
    }
    let maxNumConverted
    if (options.maxNum) {
        maxNumConverted = (0, run_1.convertNumber)(options.maxNum)
        if (maxNumConverted < 0 || maxNumConverted > 50) {
            throw new error_1.CloudBaseError('最大副本数必须大于等于0且小于等于50')
        }
    }
    let minNumConverted
    if (options.minNum) {
        minNumConverted = (0, run_1.convertNumber)(options.minNum)
        if (minNumConverted < 0 || minNumConverted > 50) {
            throw new error_1.CloudBaseError('最小副本数必须大于等于0且小于等于50')
        }
    }
    if (minNumConverted > maxNumConverted) {
        throw new error_1.CloudBaseError('最小副本数不能大于最大副本数')
    }
    return {
        cpuConverted,
        memConverted,
        maxNumConverted,
        minNumConverted
    }
}
exports.parseOptionalParams = parseOptionalParams
function parseInputParam(originalParam, override, handler, overrideVal, defaultVal, ...args) {
    return originalParam
        ? typeof handler === 'function'
            ? handler(originalParam, ...args)
            : originalParam
        : override
          ? overrideVal
          : defaultVal
}
exports.parseInputParam = parseInputParam
