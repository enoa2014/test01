import { Command } from '../common';
import { ICommandContext } from '../../types';
import { Logger } from '../../utils/log';
export declare class AICommand extends Command {
    get options(): {
        cmd: string;
        options: {
            flags: string;
            desc: string;
        }[];
        desc: string;
        requiredEnvId: boolean;
        withoutAuth: boolean;
        allowUnknownOption: boolean;
    };
    execute(options: any, ctx: ICommandContext, log: Logger): Promise<void | {
        defaultAgent: string;
    }>;
    private resetConfig;
    private showConfig;
    private parseArgs;
    private getSubCommand;
}
