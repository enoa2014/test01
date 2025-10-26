'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.validateCpuMem = exports.validateIp = exports.assertHas = exports.assertTruthy = void 0
const error_1 = require('../error')
const constant_1 = require('../constant')
const run_1 = require('../run')
function assertTruthy(val, errMsg) {
    let ok
    if (Array.isArray(val)) {
        ok = val.every((item) => Boolean(val))
    } else {
        ok = Boolean(val)
    }
    if (!ok) {
        throw new error_1.CloudBaseError(errMsg)
    }
}
exports.assertTruthy = assertTruthy
function assertHas(obj, prop, errMsg) {
    if (!obj[prop]) {
        throw new error_1.CloudBaseError(errMsg)
    }
}
exports.assertHas = assertHas
const validateIp = (ip) => {
    if (Object.prototype.toString.call(ip) !== '[object String]') return false
    const fields = ip.split('.')
    if (
        fields.length !== 4 ||
        fields.find((item) => isNaN(Number(item)) || Number(item) < 0 || Number(item) > 255)
    )
        return false
    return true
}
exports.validateIp = validateIp
const validateCpuMem = (cpuInput, memInput) => {
    if (cpuInput !== undefined && memInput !== undefined) {
        let cpuSet = (0, run_1.convertNumber)(cpuInput)
        let memSet = (0, run_1.convertNumber)(memInput)
        let validMemSet = constant_1.CPU_MEM_OPTS.find(({ cpu }) => cpu === cpuSet)
        if (!validMemSet || !validMemSet.mems.length || !validMemSet.mems.includes(memSet)) {
            throw new error_1.CloudBaseError(`cpu 与 mem 规格不匹配，当前规格：cpu: ${cpuInput}, mem: ${memInput}
请使用下列规格组合之一：${constant_1.CPU_MEM_OPTS.map(({ cpu, mems }) => `${cpu}-${mems.join('/')}`).join('，')}`)
        }
        return { cpuOutput: cpuSet, memOutput: memSet }
    }
    if (cpuInput) {
        let cpuSet = (0, run_1.convertNumber)(cpuInput)
        let validSet = constant_1.CPU_MEM_OPTS.find(({ cpu }) => cpu === cpuSet)
        if (!validSet) {
            throw new error_1.CloudBaseError(
                `不支持当前 cpu 规格，请使用下列 cpu 规格之一：${constant_1.CPU_MEM_OPTS.map(({ cpu }) => cpu).join('，')}`
            )
        }
        return {
            cpuOutput: cpuSet,
            memOutput: constant_1.CPU_MEM_OPTS.find(({ cpu }) => cpu === cpuSet).mems[0]
        }
    }
    if (memInput) {
        let memSet = (0, run_1.convertNumber)(memInput)
        let validSet = constant_1.CPU_MEM_OPTS.find(({ mems }) => mems.includes(memSet))
        if (!validSet) {
            throw new error_1.CloudBaseError(
                `不支持当前 mem 规格，请使用下列 mem 规格之一：${constant_1.CPU_MEM_OPTS.map(({ mems }) => mems.join('/')).join('，')}`
            )
        }
        return { cpuOutput: validSet.cpu, memOutput: memSet }
    }
}
exports.validateCpuMem = validateCpuMem
