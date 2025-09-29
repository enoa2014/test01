import { ITcbrServiceOptions, IDescribeWxCloudBaseRunReleaseOrder, IAuthorizedTcrInstance } from '../../types';
export declare const describeCloudRunServerDetail: (options: {
    envId: string;
    serviceName: string;
}) => Promise<any>;
export declare function describeWxCloudBaseRunReleaseOrder(options: IDescribeWxCloudBaseRunReleaseOrder): Promise<any>;
export declare const convertNumber: (item: any) => number;
export declare const extractPolicyDetails: (policyDetails: string) => {
    PolicyType: string;
    PolicyThreshold: number;
}[];
export declare const parseEnvParams: (envParams: string) => {};
export declare const mergeEnvParams: (curEnvParams: string, preEnvParams: string) => string;
export declare function tcbrServiceOptions(options: ITcbrServiceOptions, isCreated: boolean, defaultOverride?: boolean, previousServerConfig?: any): Promise<{
    ServerName: string;
    EnvId: string;
    ServerConfig: {
        EnvId: string;
        MaxNum: any;
        MinNum: any;
        BuildDir: any;
        Cpu: any;
        Mem: any;
        OpenAccessTypes: string[];
        ServerName: string;
        InitialDelaySeconds: number;
        CustomLogs: any;
        CreateTime: any;
        PolicyDetails: any;
        EnvParams: any;
        Port: number;
        HasDockerfile: boolean;
        Dockerfile: string;
        LogType: any;
        LogSetId: any;
        LogTopicId: any;
        LogParseType: any;
    };
    DeployInfo: any;
}>;
export declare function getAuthorizedTcrInstance(envId: string): Promise<IAuthorizedTcrInstance[] | null>;
export declare function validateTcrImageURL(authorizedTcrInstances: IAuthorizedTcrInstance[] | null, imageUrl: string): Promise<void>;
