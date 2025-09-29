import { Command } from '../common';
import { Logger } from '../../decorators';
export declare class LowCodeCreateComps extends Command {
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
    execute(opts: any, params: any, isPrivateEnv: boolean, config: any, log?: Logger): Promise<void>;
}
export declare class LowCodeBuildComps extends Command {
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
    execute(ctx: any, log: any): Promise<void>;
}
export declare class LowCodeDebugComps extends Command {
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
    execute(ctx: any, options: any, log: any): Promise<void>;
}
export declare class LowCodePublishComps extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        options: ({
            flags: string;
            desc: string;
            hideHelp?: undefined;
        } | {
            flags: string;
            desc: string;
            hideHelp: boolean;
        })[];
        desc: string;
        requiredEnvId: boolean;
    };
    execute(ctx: any, log: Logger, options: any): Promise<void>;
}
export declare class LowCodePublishVersionComps extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        options: ({
            flags: string;
            desc: string;
            hideHelp?: undefined;
        } | {
            flags: string;
            desc: string;
            hideHelp: boolean;
        })[];
        desc: string;
        requiredEnvId: boolean;
    };
    execute(ctx: any, options: any, log?: Logger): Promise<void>;
}
