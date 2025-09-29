import { Command } from '../../common';
import { Logger } from '../../../decorators';
export declare class ConfigServiceTcbr extends Command {
    get options(): {
        cmd: string;
        childCmd: string;
        options: {
            flags: string;
            desc: string;
        }[];
        desc: string;
    };
    execute(options: any, log: Logger): Promise<void>;
}
