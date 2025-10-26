import { Command } from '../common';
export declare class OpenLinkCommand extends Command {
    get options(): {
        cmd: string;
        options: any[];
        desc: string;
        requiredEnvId: boolean;
        withoutAuth: boolean;
    };
    execute(params: any): Promise<void>;
}
