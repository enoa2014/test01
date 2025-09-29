import { Command } from '../common';
import { Logger } from '../../decorators';
import { ICommandContext } from '../../types';
export declare class LowCodeWatch extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        options: {
            flags: string;
            desc: string;
        }[];
        desc: string;
        requiredEnvId: boolean;
    };
    execute(ctx: any, options: any): Promise<void>;
}
export declare class LowCodeBuildApp extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        options: {
            flags: string;
            desc: string;
        }[];
        desc: string;
        requiredEnvId: boolean;
    };
    execute(ctx: ICommandContext, log: Logger, options: any): Promise<void>;
}
export declare class LowCodePreviewApp extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        options: {
            flags: string;
            desc: string;
        }[];
        desc: string;
        requiredEnvId: boolean;
    };
    execute(ctx: ICommandContext, log: Logger, options: any): Promise<void>;
}
export declare class LowCodeBuildAppConfig extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        options: {
            flags: string;
            desc: string;
        }[];
        desc: string;
        requiredEnvId: boolean;
    };
    execute(ctx: ICommandContext, log: Logger, options: any): Promise<void>;
}
export declare class LowCodeDeployApp extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        options: {
            flags: string;
            desc: string;
        }[];
        desc: string;
        requiredEnvId: boolean;
    };
    execute(ctx: ICommandContext, log: Logger, options: any): Promise<void>;
}
export declare class ModelTypeSync extends Command {
    get options(): {
        cmd: string;
        options: {
            flags: string;
            desc: string;
        }[];
        desc: string;
        requiredEnvId: boolean;
        autoRunLogin: boolean;
    };
    execute(ctx: ICommandContext, log: Logger, options: any): Promise<void>;
}
