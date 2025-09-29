interface IFunctionCodeOptions {
    envId: string;
    destPath: string;
    functionName: string;
    codeSecret?: string;
}
export declare function downloadFunctionCode(options: IFunctionCodeOptions): Promise<void>;
export {};
