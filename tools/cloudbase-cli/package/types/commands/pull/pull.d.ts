import { Command } from '../common';
import { Logger } from '../../utils/log';
export declare class PullCommand extends Command {
    get options(): {
        cmd: string;
        options: {
            flags: string;
            desc: string;
        }[];
        desc: string;
        requiredEnvId: boolean;
        withoutAuth: boolean;
    };
    execute(options: any, params: string[], log: Logger): Promise<void>;
    private showTemplateList;
}
