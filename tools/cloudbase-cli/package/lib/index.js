'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.registerCommands = exports.smartDeploy = void 0
require('reflect-metadata')
require('./commands')
var commands_1 = require('./commands')
Object.defineProperty(exports, 'smartDeploy', {
    enumerable: true,
    get: function () {
        return commands_1.smartDeploy
    }
})
if (typeof globalThis === undefined) {
    globalThis = global
}
var common_1 = require('./commands/common')
Object.defineProperty(exports, 'registerCommands', {
    enumerable: true,
    get: function () {
        return common_1.registerCommands
    }
})
