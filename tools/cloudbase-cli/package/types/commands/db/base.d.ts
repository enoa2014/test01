import { Command } from '../common';
import { Logger } from '../../decorators';
export declare class DbListCommand extends Command {
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
export declare class DbPullCommand extends Command {
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
    execute(envId: any, params: any, log: Logger): Promise<void>;
}
export declare class DbPushCommand extends Command {
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
    execute(envId: any, params: any, log: Logger): Promise<void>;
}
