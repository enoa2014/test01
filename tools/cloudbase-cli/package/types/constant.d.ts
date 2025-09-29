export declare class ConfigItems {
    static credential: string;
    static ssh: string;
}
export declare const DefaultFunctionDeployConfig: {
    timeout: number;
    handler: string;
    runtime: string;
    installDependency: boolean;
    ignore: string[];
};
export declare const DefaultCloudBaseConfig: {
    functionRoot: string;
    functions: any[];
};
export declare const REQUEST_TIMEOUT = 15000;
export declare const enum ENV_STATUS {
    UNAVAILABLE = "UNAVAILABLE",
    NORMAL = "NORMAL",
    ISOLATE = "ISOLATE",
    ABNORMAL = "ABNORMAL",
    ERROR = "ERROR"
}
export declare const STATUS_TEXT: {
    UNAVAILABLE: string;
    NORMAL: string;
    ISOLATE: string;
    ABNORMAL: string;
    ERROR: string;
};
export declare const ALL_COMMANDS: string[];
export declare const StatusMap: {
    Active: string;
    Creating: string;
    CreateFailed: string;
    Updating: string;
    UpdateFailed: string;
    Publishing: string;
    PublishFailed: string;
    Deleting: string;
    DeleteFailed: string;
};
export declare const ConcurrencyTaskStatus: {
    Done: string;
    InProgress: string;
    Failed: string;
};
export declare const enum EnumEnvCheck {
    EnvFit = 0,
    EnvNewCmdOld = 1,
    EnvOldCmdNew = 2
}
export declare const enum EnumDeployStatus {
    Deploying = "deploying",
    DeploySuccess = "running",
    DeployFailed = "deploy_failed"
}
export declare const CPU_MEM_OPTS: {
    cpu: number;
    mems: number[];
}[];
export declare const DEFAULT_CPU_MEM_SET: {
    PolicyType: 'mem' | 'cpu';
    PolicyThreshold: number;
}[];
export declare enum EnvType {
    BAAS = "baas",
    RUN = "run",
    HOTING = "hoting",
    WEDA = "weda"
}
