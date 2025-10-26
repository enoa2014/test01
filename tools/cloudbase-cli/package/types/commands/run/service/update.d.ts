import { Command } from '../../common';
export declare class UpdateServiceTcbr extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        options: {
            flags: string;
            desc: string;
        }[];
        desc: string;
    };
    execute(options: any): Promise<void>;
}
