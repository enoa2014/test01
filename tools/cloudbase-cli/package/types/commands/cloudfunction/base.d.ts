import { Logger } from '../../decorators';
import { Command } from '../common';
export declare class CloudFunctionDeployCommand extends Command {
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
    execute(ctx: any, envId: any, log: Logger, options: any): Promise<void>;
}
export declare class CloudFunctionDownloadCommand extends Command {
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
    execute(ctx: any, envId: any, log: Logger, options: any): Promise<void>;
}
export declare class CloudFunctionRunCommand extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        options: {
            flags: string;
            desc: string;
        }[];
        requiredEnvId: boolean;
        desc: string;
    };
    execute(logger: Logger, ctx: any, options: any): Promise<void>;
}
