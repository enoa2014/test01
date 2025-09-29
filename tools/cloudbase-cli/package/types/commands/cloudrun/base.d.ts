import { Logger } from '../../decorators';
import { Command } from '../common';
export declare function getCloudrunService(envId: string): Promise<import("@cloudbase/manager-node/types/cloudrun").CloudRunService>;
export declare function getAgentService(envId: string): Promise<import("@cloudbase/manager-node/types/agent").AgentService>;
export declare class CloudRunInitCommand extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        options: {
            flags: string;
            desc: string;
        }[];
        requiredEnvId: boolean;
        autoRunLogin: boolean;
        desc: string;
    };
    execute(ctx: any, envId: string, log: Logger, options: {
        serviceName?: string;
        targetPath?: string;
        template?: string;
    }): Promise<void>;
}
export declare class CloudRunListCommand extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        options: ({
            flags: string;
            desc: string;
            defaultValue?: undefined;
            choices?: undefined;
        } | {
            flags: string;
            desc: string;
            defaultValue: number;
            choices?: undefined;
        } | {
            flags: string;
            desc: string;
            choices: string[];
            defaultValue?: undefined;
        })[];
        requiredEnvId: boolean;
        autoRunLogin: boolean;
        desc: string;
    };
    execute(ctx: any, envId: string, log: Logger, options: {
        pageSize?: string;
        pageNum?: string;
        serviceName?: string;
        serverType?: string;
    }): Promise<void>;
}
export declare class CloudRunDownloadCommand extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        options: ({
            flags: string;
            desc: string;
            required?: undefined;
            defaultValue?: undefined;
        } | {
            flags: string;
            desc: string;
            required: boolean;
            defaultValue?: undefined;
        } | {
            flags: string;
            desc: string;
            defaultValue: string;
            required?: undefined;
        } | {
            flags: string;
            desc: string;
            defaultValue: boolean;
            required?: undefined;
        })[];
        requiredEnvId: boolean;
        autoRunLogin: boolean;
        desc: string;
    };
    execute(ctx: any, envId: string, log: Logger, options: {
        serviceName: string;
        targetPath: string;
        force: boolean;
    }): Promise<void>;
}
export declare class CloudRunDeleteCommand extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        options: ({
            flags: string;
            desc: string;
            required?: undefined;
            defaultValue?: undefined;
        } | {
            flags: string;
            desc: string;
            required: boolean;
            defaultValue?: undefined;
        } | {
            flags: string;
            desc: string;
            defaultValue: boolean;
            required?: undefined;
        })[];
        requiredEnvId: boolean;
        autoRunLogin: boolean;
        desc: string;
    };
    execute(ctx: any, envId: string, log: Logger, options: {
        serviceName: string;
        force: boolean;
    }): Promise<void>;
}
export declare class CloudRunDeployCommand extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        options: ({
            flags: string;
            desc: string;
            defaultValue?: undefined;
        } | {
            flags: string;
            desc: string;
            defaultValue: boolean;
        })[];
        requiredEnvId: boolean;
        autoRunLogin: boolean;
        desc: string;
    };
    execute(ctx: any, envId: string, log: Logger, options: {
        serviceName?: string;
        source?: string;
        force?: boolean;
        port?: number;
        createAgent?: boolean;
    }): Promise<void>;
}
export declare class CloudRunRunCommand extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        allowUnknownOption: boolean;
        options: {
            flags: string;
            desc: string;
        }[];
        requiredEnvId: boolean;
        desc: string;
    };
    execute(envId: string, logger: Logger, ctx: any, options: any): Promise<void>;
    private checkAndRunTsc;
    private openDebugApp;
    private waitForPort;
}
