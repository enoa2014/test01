import { Command } from './common';
export declare class SelfUpdateCommand extends Command {
    get options(): {
        cmd: string;
        desc: string;
        requiredEnvId: boolean;
        withoutAuth: boolean;
        options: {
            flags: string;
            desc: string;
        }[];
    };
    execute(ctx: any): Promise<void>;
}
export declare class RollbackCommand extends Command {
    get options(): {
        cmd: string;
        desc: string;
        requiredEnvId: boolean;
        withoutAuth: boolean;
        options: any[];
    };
    execute(): Promise<void>;
}
