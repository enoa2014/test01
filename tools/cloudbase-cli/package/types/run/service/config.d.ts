import { ITcbrServiceConfigOptions } from '../../types';
export declare function tcbrServiceConfigOptions(options: ITcbrServiceConfigOptions): Promise<{
    EnvId: string;
    ServerName: string;
    OpenAccessTypes: string[];
    Cpu: number;
    Mem: number;
    MinNum: number;
    MaxNum: number;
    PolicyDetails: {
        PolicyType: string;
        PolicyThreshold: number;
    }[];
    CustomLogs: string;
    EnvParams: string;
    InitialDelaySeconds: number;
    CreateTime: string;
    Port: number;
    HasDockerfile: boolean;
    Dockerfile: string;
    BuildDir: string;
}>;
export declare function updateCloudRunServerConfig(options: any): Promise<any>;
