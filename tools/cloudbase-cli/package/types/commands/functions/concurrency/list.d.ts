import { Command } from '../../common';
export declare class getProvisionedConcurrency extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        options: {
            flags: string;
            desc: string;
        }[];
        desc: string;
    };
    execute(ctx: any, params: any, options: any): Promise<void>;
}
