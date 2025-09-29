interface IPackageDeploy {
    envId: string;
    serviceName: string;
    filePath: string;
    fileToIgnore?: string | string[];
}
export declare function packageDeploy(options: IPackageDeploy): Promise<{
    PackageName: any;
    PackageVersion: any;
}>;
export {};
