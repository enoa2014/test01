import { Logger } from '../decorators';
export declare function selectEnv(options?: {
    source?: string[];
}): Promise<string>;
export declare function getPackageJsonName(pkgPath: string): Promise<{
    fullName: any;
    shortName: any;
}>;
export declare function isDirectoryEmptyOrNotExists(dirPath: string): Promise<boolean>;
export declare function trackCallback(message: any, log: Logger): void;
export declare function getCredential(ctx: any, options: any): Promise<any>;
export declare function fetchAccessToken(params: {
    envId: string;
    secretId: string;
    secretKey: string;
    token?: string;
}): Promise<any>;
export declare function rawFetchAccessToken(params: {
    envId: string;
    secretId: string;
    secretKey: string;
    token?: string;
}): Promise<any>;
export declare function upsertCloudbaserc(projectPath: string, inputData: {
    envId?: string;
    [key: string]: any;
}): Promise<void>;
export declare function getCloudbaserc(projectPath: string): Promise<{}>;
