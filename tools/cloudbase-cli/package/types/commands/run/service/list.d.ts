import { Command } from '../../common';
export declare class ListServiceTcbr extends Command {
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
