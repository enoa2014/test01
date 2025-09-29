import { Logger } from './log';
interface PullOptions {
    output?: string;
    force?: boolean;
}
export declare class TemplateManager {
    private git;
    private mcpConfigModifier;
    constructor();
    pullTemplate(source: string, options: PullOptions, log: Logger): Promise<void>;
    private isBuiltinTemplate;
    private isGitUrl;
    private parseGitUrl;
    private buildGitUrl;
    private cloneWithSubpathOptimized;
    private cloneWithSubpath;
    private downloadBuiltinTemplateToTemp;
    private downloadGitTemplateToTemp;
    private copyFromTempToTarget;
    private copyFilesWithOverwrite;
    private copyFilesSkipExisting;
    private chunkArray;
    getBuiltinTemplates(): Record<string, string>;
}
export {};
