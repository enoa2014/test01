import { Logger } from '../../decorators';
import { Command } from '../common';
export declare class FunListCommand extends Command {
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
    execute(envId: any, log: Logger): Promise<void>;
}
export declare class FunDeployCommand extends Command {
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
    execute(envId: any, log: Logger, options: any): Promise<void>;
}
export declare class FunRunCommand extends Command {
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
    execute(logger: Logger): Promise<void>;
}
