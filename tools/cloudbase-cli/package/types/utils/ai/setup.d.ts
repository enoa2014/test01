import { Logger } from '../log';
export declare class AISetupWizard {
    private aiConfigManager;
    private envId?;
    constructor(envId?: string);
    setUpDefault(log: Logger, agent?: string): Promise<{
        defaultAgent: string;
    }>;
    setUp(log: Logger): Promise<{
        defaultAgent: string;
    }>;
    configureEnvId(log: Logger, _envId: string): Promise<string>;
    private selectDefaultAgent;
    private selectCurrentAgent;
    private showConfigInfo;
    private selectAgent;
    private configureAgent;
    private configureClaudeAgent;
    private configureQwenAgent;
    private configureCodexAgent;
    private configureAiderAgent;
    private configureCursorAgent;
    private ensureGitignore;
    private selectCloudBaseProvider;
    private configureCodebuddyAgent;
}
