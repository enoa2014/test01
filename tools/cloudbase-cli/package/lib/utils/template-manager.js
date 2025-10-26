'use strict'
var __createBinding =
    (this && this.__createBinding) ||
    (Object.create
        ? function (o, m, k, k2) {
              if (k2 === undefined) k2 = k
              var desc = Object.getOwnPropertyDescriptor(m, k)
              if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
                  desc = {
                      enumerable: true,
                      get: function () {
                          return m[k]
                      }
                  }
              }
              Object.defineProperty(o, k2, desc)
          }
        : function (o, m, k, k2) {
              if (k2 === undefined) k2 = k
              o[k2] = m[k]
          })
var __setModuleDefault =
    (this && this.__setModuleDefault) ||
    (Object.create
        ? function (o, v) {
              Object.defineProperty(o, 'default', { enumerable: true, value: v })
          }
        : function (o, v) {
              o['default'] = v
          })
var __importStar =
    (this && this.__importStar) ||
    function (mod) {
        if (mod && mod.__esModule) return mod
        var result = {}
        if (mod != null)
            for (var k in mod)
                if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k))
                    __createBinding(result, mod, k)
        __setModuleDefault(result, mod)
        return result
    }
var __awaiter =
    (this && this.__awaiter) ||
    function (thisArg, _arguments, P, generator) {
        function adopt(value) {
            return value instanceof P
                ? value
                : new P(function (resolve) {
                      resolve(value)
                  })
        }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) {
                try {
                    step(generator.next(value))
                } catch (e) {
                    reject(e)
                }
            }
            function rejected(value) {
                try {
                    step(generator['throw'](value))
                } catch (e) {
                    reject(e)
                }
            }
            function step(result) {
                result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected)
            }
            step((generator = generator.apply(thisArg, _arguments || [])).next())
        })
    }
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, '__esModule', { value: true })
exports.TemplateManager = void 0
const fs_extra_1 = __importDefault(require('fs-extra'))
const path_1 = __importDefault(require('path'))
const simple_git_1 = require('simple-git')
const error_1 = require('../error')
const mcp_config_modifier_1 = require('./mcp-config-modifier')
const BUILTIN_TEMPLATES = {
    miniprogram: {
        url: 'https://static.cloudbase.net/cloudbase-examples/miniprogram-cloudbase-miniprogram-template.zip',
        name: '微信小程序 + CloudBase'
    },
    react: {
        url: 'https://static.cloudbase.net/cloudbase-examples/web-cloudbase-react-template.zip',
        name: 'Web 应用 - React + CloudBase'
    },
    vue: {
        url: 'https://static.cloudbase.net/cloudbase-examples/web-cloudbase-vue-template.zip',
        name: 'Web 应用 - Vue + CloudBase'
    },
    uniapp: {
        url: 'https://static.cloudbase.net/cloudbase-examples/universal-cloudbase-uniapp-template.zip',
        name: '跨端应用 - UniApp + CloudBase'
    },
    rules: {
        url: 'https://static.cloudbase.net/cloudbase-examples/web-cloudbase-project.zip',
        name: 'AI 规则和配置'
    }
}
class TemplateManager {
    constructor() {
        this.git = (0, simple_git_1.simpleGit)()
        this.mcpConfigModifier = new mcp_config_modifier_1.MCPConfigModifier()
    }
    pullTemplate(source, options = {}, log) {
        return __awaiter(this, void 0, void 0, function* () {
            const targetPath = options.output || process.cwd()
            const { force = false } = options
            yield fs_extra_1.default.ensureDir(targetPath)
            const tempDir = path_1.default.join(process.cwd(), '.temp-template-' + Date.now())
            try {
                if (this.isBuiltinTemplate(source)) {
                    yield this.downloadBuiltinTemplateToTemp(source, tempDir, log)
                } else if (this.isGitUrl(source)) {
                    const gitInfo = this.parseGitUrl(source)
                    yield this.downloadGitTemplateToTemp(gitInfo, tempDir, log)
                } else {
                    throw new error_1.CloudBaseError(
                        `不支持的模板来源: ${typeof source === 'string' ? source : JSON.stringify(source)}`
                    )
                }
                yield this.copyFromTempToTarget(tempDir, targetPath, force, log)
                log.info(`✅ 模板拉取完成: ${targetPath}`)
            } finally {
                yield fs_extra_1.default.remove(tempDir)
            }
        })
    }
    isBuiltinTemplate(source) {
        return Object.keys(BUILTIN_TEMPLATES).includes(source)
    }
    isGitUrl(source) {
        if (!source || typeof source !== 'string') {
            return false
        }
        return (
            source.startsWith('http') ||
            source.startsWith('git@') ||
            source.includes('github.com') ||
            source.includes('gitee.com') ||
            source.includes('cnb.cool')
        )
    }
    parseGitUrl(url) {
        const githubMatch = url.match(
            /https?:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+)\/(.+))?/
        )
        if (githubMatch) {
            return {
                platform: 'github',
                owner: githubMatch[1],
                repo: githubMatch[2].replace('.git', ''),
                branch: githubMatch[3] || 'master',
                subpath: githubMatch[4]
            }
        }
        const giteeMatch = url.match(
            /https?:\/\/gitee\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+)\/(.+))?/
        )
        if (giteeMatch) {
            return {
                platform: 'gitee',
                owner: giteeMatch[1],
                repo: giteeMatch[2].replace('.git', ''),
                branch: giteeMatch[3] || 'master',
                subpath: giteeMatch[4]
            }
        }
        const cnbMatchWithDash = url.match(/https?:\/\/cnb\.cool\/(.+?)\/-\/tree\/([^\/]+)\/(.+)$/)
        if (cnbMatchWithDash) {
            const pathParts = cnbMatchWithDash[1].split('/').filter((p) => p.length > 0)
            if (pathParts.length >= 2) {
                return {
                    platform: 'cnb',
                    owner: pathParts[0],
                    repo: pathParts.slice(1).join('/'),
                    branch: cnbMatchWithDash[2] || 'main',
                    subpath: cnbMatchWithDash[3]
                }
            }
        }
        const cnbMatch = url.match(/https?:\/\/cnb\.cool\/(.+?)(?:\/tree\/([^\/]+)\/(.+))?$/)
        if (cnbMatch) {
            const pathParts = cnbMatch[1].split('/').filter((p) => p.length > 0)
            if (pathParts.length >= 2) {
                return {
                    platform: 'cnb',
                    owner: pathParts[0],
                    repo: pathParts.slice(1).join('/'),
                    branch: cnbMatch[2] || 'main',
                    subpath: cnbMatch[3]
                }
            }
        }
        const sshMatch = url.match(/git@([^:]+):([^\/]+)\/([^\/]+)\.git/)
        if (sshMatch) {
            return {
                platform:
                    sshMatch[1] === 'github.com'
                        ? 'github'
                        : sshMatch[1] === 'cnb.cool'
                          ? 'cnb'
                          : 'gitee',
                owner: sshMatch[2],
                repo: sshMatch[3],
                branch: 'main'
            }
        }
        throw new error_1.CloudBaseError(`无法解析 Git URL: ${url}`)
    }
    buildGitUrl(gitInfo) {
        if (gitInfo.platform === 'github') {
            return `https://github.com/${gitInfo.owner}/${gitInfo.repo}.git`
        } else if (gitInfo.platform === 'gitee') {
            return `https://gitee.com/${gitInfo.owner}/${gitInfo.repo}.git`
        } else if (gitInfo.platform === 'cnb') {
            return `https://cnb.cool/${gitInfo.owner}/${gitInfo.repo}.git`
        }
        throw new error_1.CloudBaseError(`不支持的 Git 平台: ${gitInfo.platform}`)
    }
    cloneWithSubpathOptimized(gitUrl, tempDir, gitInfo, log) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.git.clone(gitUrl, tempDir, [
                    '--depth',
                    '1',
                    '--single-branch',
                    '--branch',
                    gitInfo.branch,
                    '--filter=blob:none'
                ])
                const subpathFull = path_1.default.join(tempDir, gitInfo.subpath)
                if (!(yield fs_extra_1.default.pathExists(subpathFull))) {
                    throw new error_1.CloudBaseError(`子目录不存在: ${gitInfo.subpath}`)
                }
                const tempContentDir = path_1.default.join(tempDir, '.temp-content-' + Date.now())
                yield fs_extra_1.default.move(subpathFull, tempContentDir)
                const tempFiles = yield fs_extra_1.default.readdir(tempDir)
                for (const file of tempFiles) {
                    if (file !== path_1.default.basename(tempContentDir)) {
                        yield fs_extra_1.default.remove(path_1.default.join(tempDir, file))
                    }
                }
                const contentFiles = yield fs_extra_1.default.readdir(tempContentDir)
                for (const file of contentFiles) {
                    yield fs_extra_1.default.move(
                        path_1.default.join(tempContentDir, file),
                        path_1.default.join(tempDir, file)
                    )
                }
                yield fs_extra_1.default.remove(tempContentDir)
            } catch (error) {
                throw new error_1.CloudBaseError(`克隆子目录失败: ${error.message}`, {
                    original: error
                })
            }
        })
    }
    cloneWithSubpath(gitUrl, tempDir, gitInfo, log) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.git.clone(gitUrl, tempDir)
                const tempGit = (0, simple_git_1.simpleGit)(tempDir)
                yield tempGit.checkout(gitInfo.branch)
                const subpathFull = path_1.default.join(tempDir, gitInfo.subpath)
                if (!(yield fs_extra_1.default.pathExists(subpathFull))) {
                    throw new error_1.CloudBaseError(`子目录不存在: ${gitInfo.subpath}`)
                }
                const tempContentDir = path_1.default.join(tempDir, '.temp-content-' + Date.now())
                yield fs_extra_1.default.move(subpathFull, tempContentDir)
                const tempFiles = yield fs_extra_1.default.readdir(tempDir)
                for (const file of tempFiles) {
                    if (file !== path_1.default.basename(tempContentDir)) {
                        yield fs_extra_1.default.remove(path_1.default.join(tempDir, file))
                    }
                }
                const contentFiles = yield fs_extra_1.default.readdir(tempContentDir)
                for (const file of contentFiles) {
                    yield fs_extra_1.default.move(
                        path_1.default.join(tempContentDir, file),
                        path_1.default.join(tempDir, file)
                    )
                }
                yield fs_extra_1.default.remove(tempContentDir)
            } catch (error) {
                throw new error_1.CloudBaseError(`克隆子目录失败: ${error.message}`, {
                    original: error
                })
            }
        })
    }
    downloadBuiltinTemplateToTemp(templateId, tempDir, log) {
        return __awaiter(this, void 0, void 0, function* () {
            const template = BUILTIN_TEMPLATES[templateId]
            if (!template) {
                throw new error_1.CloudBaseError(`未知的内置模板: ${templateId}`)
            }
            log.info(`📦 正在下载 ${template.name} 模板到临时目录...`)
            try {
                const { downloadAndExtractRemoteZip } = yield Promise.resolve().then(() =>
                    __importStar(require('./tools/common'))
                )
                yield downloadAndExtractRemoteZip(template.url, tempDir)
                log.info(`✅ ${template.name} 模板下载完成到临时目录`)
            } catch (error) {
                throw new error_1.CloudBaseError(`下载内置模板失败: ${error.message}`, {
                    original: error
                })
            }
        })
    }
    downloadGitTemplateToTemp(gitInfo, tempDir, log) {
        return __awaiter(this, void 0, void 0, function* () {
            const gitUrl = this.buildGitUrl(gitInfo)
            log.info(`📦 正在从 ${gitInfo.platform} 下载模板到临时目录...`)
            try {
                if (gitInfo.subpath) {
                    yield this.cloneWithSubpathOptimized(gitUrl, tempDir, gitInfo, log)
                } else {
                    yield this.git.clone(gitUrl, tempDir, [
                        '--depth',
                        '1',
                        '--single-branch',
                        '--branch',
                        gitInfo.branch
                    ])
                }
                log.info(`✅ Git 模板下载完成到临时目录`)
            } catch (error) {
                throw new error_1.CloudBaseError(`Git 模板下载失败: ${error.message}`, {
                    original: error
                })
            }
        })
    }
    copyFromTempToTarget(tempDir, targetPath, force, log) {
        return __awaiter(this, void 0, void 0, function* () {
            log.info(`📦 正在从临时目录复制到目标目录 ${targetPath}...`)
            try {
                if (force) {
                    if (yield fs_extra_1.default.pathExists(targetPath)) {
                        const files = yield fs_extra_1.default.readdir(targetPath)
                        if (files.length > 0) {
                            log.info(`⚠️  使用 --force 参数，将覆盖目标目录中的现有文件`)
                        }
                    }
                    yield this.copyFilesWithOverwrite(tempDir, targetPath, log)
                } else {
                    if (yield fs_extra_1.default.pathExists(targetPath)) {
                        const files = yield fs_extra_1.default.readdir(targetPath)
                        if (files.length > 0) {
                            log.info(`ℹ️  目标目录不为空，将跳过已存在的文件，只复制新文件`)
                        }
                    }
                    yield this.copyFilesSkipExisting(tempDir, targetPath, log)
                }
                log.info(`✅ 模板复制完成`)
                try {
                    log.debug('🔧 开始调用 MCP 配置修改器...')
                    yield this.mcpConfigModifier.modifyMCPConfigs(targetPath, log)
                    log.debug('✅ MCP 配置修改器调用完成')
                } catch (error) {
                    log.warn(`⚠️ MCP 配置修改失败: ${error.message}`)
                }
            } catch (error) {
                throw new error_1.CloudBaseError(`复制模板失败: ${error.message}`, {
                    original: error
                })
            }
        })
    }
    copyFilesWithOverwrite(sourceDir, targetDir, log) {
        return __awaiter(this, void 0, void 0, function* () {
            let copiedCount = 0
            let overwrittenCount = 0
            const copyFile = (srcPath, destPath) =>
                __awaiter(this, void 0, void 0, function* () {
                    try {
                        const stat = yield fs_extra_1.default.stat(srcPath)
                        if (stat.isDirectory()) {
                            yield fs_extra_1.default.ensureDir(destPath)
                            const entries = yield fs_extra_1.default.readdir(srcPath, {
                                withFileTypes: true
                            })
                            const copyPromises = entries.map((entry) => {
                                const entrySrcPath = path_1.default.join(srcPath, entry.name)
                                const entryDestPath = path_1.default.join(destPath, entry.name)
                                return copyFile(entrySrcPath, entryDestPath)
                            })
                            const chunks = this.chunkArray(copyPromises, 10)
                            for (const chunk of chunks) {
                                yield Promise.all(chunk)
                            }
                        } else {
                            const exists = yield fs_extra_1.default.pathExists(destPath)
                            yield fs_extra_1.default.ensureDir(path_1.default.dirname(destPath))
                            yield fs_extra_1.default.copy(srcPath, destPath)
                            const relativePath = path_1.default.relative(sourceDir, srcPath)
                            if (exists) {
                                overwrittenCount++
                            } else {
                                copiedCount++
                            }
                        }
                    } catch (error) {
                        log.warn(
                            `⚠️  复制失败: ${path_1.default.relative(sourceDir, srcPath)} - ${error.message}`
                        )
                    }
                })
            const entries = yield fs_extra_1.default.readdir(sourceDir, { withFileTypes: true })
            const copyPromises = entries.map((entry) => {
                const srcPath = path_1.default.join(sourceDir, entry.name)
                const destPath = path_1.default.join(targetDir, entry.name)
                return copyFile(srcPath, destPath)
            })
            const chunks = this.chunkArray(copyPromises, 5)
            for (const chunk of chunks) {
                yield Promise.all(chunk)
            }
            log.info(`📊 复制统计: ${copiedCount} 个新文件复制, ${overwrittenCount} 个文件覆盖`)
        })
    }
    copyFilesSkipExisting(sourceDir, targetDir, log) {
        return __awaiter(this, void 0, void 0, function* () {
            let copiedCount = 0
            let skippedCount = 0
            const copyFile = (srcPath, destPath) =>
                __awaiter(this, void 0, void 0, function* () {
                    try {
                        const stat = yield fs_extra_1.default.stat(srcPath)
                        if (stat.isDirectory()) {
                            yield fs_extra_1.default.ensureDir(destPath)
                            const entries = yield fs_extra_1.default.readdir(srcPath, {
                                withFileTypes: true
                            })
                            const copyPromises = entries.map((entry) => {
                                const entrySrcPath = path_1.default.join(srcPath, entry.name)
                                const entryDestPath = path_1.default.join(destPath, entry.name)
                                return copyFile(entrySrcPath, entryDestPath)
                            })
                            const chunks = this.chunkArray(copyPromises, 10)
                            for (const chunk of chunks) {
                                yield Promise.all(chunk)
                            }
                        } else {
                            if (!(yield fs_extra_1.default.pathExists(destPath))) {
                                yield fs_extra_1.default.ensureDir(path_1.default.dirname(destPath))
                                yield fs_extra_1.default.copy(srcPath, destPath)
                                const relativePath = path_1.default.relative(sourceDir, srcPath)
                                copiedCount++
                            } else {
                                const relativePath = path_1.default.relative(sourceDir, srcPath)
                                skippedCount++
                            }
                        }
                    } catch (error) {
                        log.warn(
                            `⚠️  复制失败: ${path_1.default.relative(sourceDir, srcPath)} - ${error.message}`
                        )
                    }
                })
            const entries = yield fs_extra_1.default.readdir(sourceDir, { withFileTypes: true })
            const copyPromises = entries.map((entry) => {
                const srcPath = path_1.default.join(sourceDir, entry.name)
                const destPath = path_1.default.join(targetDir, entry.name)
                return copyFile(srcPath, destPath)
            })
            const chunks = this.chunkArray(copyPromises, 5)
            for (const chunk of chunks) {
                yield Promise.all(chunk)
            }
            log.info(`📊 复制统计: ${copiedCount} 个文件复制完成, ${skippedCount} 个文件跳过`)
        })
    }
    chunkArray(array, chunkSize) {
        const chunks = []
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize))
        }
        return chunks
    }
    getBuiltinTemplates() {
        const templates = {}
        for (const [key, template] of Object.entries(BUILTIN_TEMPLATES)) {
            templates[key] = template.name
        }
        return templates
    }
}
exports.TemplateManager = TemplateManager
