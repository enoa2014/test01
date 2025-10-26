export interface AIEnvConfig {
    defaultAgent: string;
    agents: {
        [agentName: string]: {
            apiKey?: string;
            baseUrl?: string;
            model?: string;
        };
    };
}
export declare class EnvLocalManager {
    updateEnvId(envId: string): void;
    parseEnvFile(): Promise<Record<string, string>>;
    updateAIConfig(aiConfig: AIEnvConfig): Promise<void>;
    removeAIConfig(agentName?: string): Promise<void>;
    validateAIConfig(aiConfig: AIEnvConfig): string[];
    updateDefaultAgent(agent: string): void;
    setEnvLocal(key: string, value: string): void;
    removeEnvLocal(key: string): void;
    private removeAIConfigFromMap;
    private removeSpecificAgentConfig;
    private addAIConfigToEnv;
}
