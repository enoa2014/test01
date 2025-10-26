import { Logger } from './log';
export declare class MCPConfigModifier {
    modifyMCPConfigs(extractDir: string, log: Logger): Promise<void>;
    private modifyMCPJsonFile;
    private modifyMCPTomlFile;
    private objectToToml;
}
