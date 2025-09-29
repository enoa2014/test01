import { ConfigParser } from '@cloudbase/toolbox';
import { CLAUDE, QWEN, CODEX, AIDER, CURSOR, CODEBUDDY } from './const';
import z from 'zod/v3';
export declare const CONFIG_NOT_FOUND = "CONFIG_NOT_FOUND";
export declare function isValidAgent(agent: unknown): agent is keyof AIConfig['agents'];
export interface AIConfig {
    defaultAgent: string;
    agents: {
        claude?: z.infer<(typeof CLAUDE)['configSchema']>;
        qwen?: z.infer<(typeof QWEN)['configSchema']>;
        codex?: z.infer<(typeof CODEX)['configSchema']>;
        aider?: z.infer<(typeof AIDER)['configSchema']>;
        cursor?: z.infer<(typeof CURSOR)['configSchema']>;
        codebuddy?: z.infer<(typeof CODEBUDDY)['configSchema']>;
    };
}
export interface AgentConfig {
    enabled: boolean;
    command: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    maxTokens?: number;
}
export declare const TOOLKIT_CONFIGS: {
    [x: string]: {
        mcp: string;
        rules: string;
        config?: undefined;
    } | {
        config: string;
        mcp: string;
        rules: string;
    } | {
        config: string;
        mcp?: undefined;
        rules?: undefined;
    } | {
        config: string;
        rules: string;
        mcp?: undefined;
    };
};
export declare function createConfigParser(): ConfigParser;
export declare class AIConfigManager {
    private envLocalManager;
    loadConfig(): Promise<AIConfig>;
    isConfigured(): Promise<boolean>;
    getAgentConfig(agent: string): Promise<AgentConfig | null>;
    resetConfig(): Promise<void>;
    checkToolkitConfig(agent: string): Promise<{
        hasConfig: boolean;
        hasMcp: boolean;
        hasRules: boolean;
        missingFiles: string[];
    }>;
    updateEnvId(envId: string): Promise<void>;
    updateDefaultAgent(agent: string): Promise<void>;
    updateClaudeConfig(type: 'custom' | 'cloudbase' | 'none', config: {
        baseUrl?: string;
        apiKey?: string;
        provider?: string;
        model?: string;
        transformer?: string;
    }): Promise<void>;
    updateQwenConfig(type: 'custom' | 'cloudbase' | 'none', config: {
        baseUrl?: string;
        apiKey?: string;
        provider?: string;
        model?: string;
    }): Promise<void>;
    updateCodexConfig(type: 'custom' | 'cloudbase' | 'none', config: {
        baseUrl?: string;
        apiKey?: string;
        provider?: string;
        model?: string;
    }): Promise<void>;
    updateAiderConfig(type: 'custom' | 'cloudbase', config: {
        apiKey?: string;
        baseUrl?: string;
        model?: string;
        provider?: string;
    }): Promise<void>;
    updateCursorConfig(type: 'none'): Promise<void>;
    updateCodebuddyConfig(type: 'custom' | 'none', config: {
        apiKey?: string;
    }): Promise<void>;
    private updateConfig;
}
