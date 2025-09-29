import { Command } from '../../common';
export declare class setFunctionRoutingConfig extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        options: {
            flags: string;
            desc: string;
        }[];
        desc: string;
    };
    execute(ctx: any, params: any): Promise<void>;
}
