import z from 'zod/v3';
export declare const CONFIG_PATH: string;
export declare const ENV_LOCAL_PATH: string;
export declare const CLAUDE_CODE_ROUTER_CONFIG_PATH: string;
export declare const CLAUDE_CODE_ROUTER_LOG_PATH: string;
export declare const CLAUDE_CODE_ROUTER_LOGS_DIR_PATH: string;
export declare const CLOUDBASE_MCP_CONFIG_PATH: string;
export declare const DEFAULT_CONFIG = "{\n  \"envId\": \"{{env.ENV_ID}}\"\n}";
export declare const CLAUDE: {
    name: string;
    value: string;
    configSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"none">;
    }, "strip", z.ZodTypeAny, {
        type?: "none";
    }, {
        type?: "none";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"custom">;
        baseUrl: z.ZodString;
        apiKey: z.ZodString;
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type?: "custom";
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    }, {
        type?: "custom";
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"cloudbase">;
        provider: z.ZodString;
        model: z.ZodString;
        transformer: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type?: "cloudbase";
        transformer?: string;
        model?: string;
        provider?: string;
    }, {
        type?: "cloudbase";
        transformer?: string;
        model?: string;
        provider?: string;
    }>]>;
};
export declare const QWEN: {
    name: string;
    value: string;
    configSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"none">;
    }, "strip", z.ZodTypeAny, {
        type?: "none";
    }, {
        type?: "none";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"custom">;
        baseUrl: z.ZodString;
        apiKey: z.ZodString;
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type?: "custom";
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    }, {
        type?: "custom";
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"cloudbase">;
        provider: z.ZodString;
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type?: "cloudbase";
        model?: string;
        provider?: string;
    }, {
        type?: "cloudbase";
        model?: string;
        provider?: string;
    }>]>;
};
export declare const CODEX: {
    name: string;
    value: string;
    configSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"none">;
    }, "strip", z.ZodTypeAny, {
        type?: "none";
    }, {
        type?: "none";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"custom">;
        baseUrl: z.ZodString;
        apiKey: z.ZodString;
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type?: "custom";
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    }, {
        type?: "custom";
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"cloudbase">;
        provider: z.ZodString;
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type?: "cloudbase";
        model?: string;
        provider?: string;
    }, {
        type?: "cloudbase";
        model?: string;
        provider?: string;
    }>]>;
};
export declare const AIDER: {
    name: string;
    value: string;
    configSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"custom">;
        baseUrl: z.ZodString;
        apiKey: z.ZodString;
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type?: "custom";
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    }, {
        type?: "custom";
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"cloudbase">;
        provider: z.ZodString;
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type?: "cloudbase";
        model?: string;
        provider?: string;
    }, {
        type?: "cloudbase";
        model?: string;
        provider?: string;
    }>]>;
};
export declare const CURSOR: {
    name: string;
    value: string;
    configSchema: z.ZodObject<{
        type: z.ZodLiteral<"none">;
    }, "strip", z.ZodTypeAny, {
        type?: "none";
    }, {
        type?: "none";
    }>;
};
export declare const CODEBUDDY: {
    name: string;
    value: string;
    configSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"none">;
    }, "strip", z.ZodTypeAny, {
        type?: "none";
    }, {
        type?: "none";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"custom">;
        apiKey: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type?: "custom";
        apiKey?: string;
    }, {
        type?: "custom";
        apiKey?: string;
    }>]>;
};
export declare const NONE: {
    name: string;
    value: string;
};
export declare const AGENTS: readonly [{
    name: string;
    value: string;
    configSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"none">;
    }, "strip", z.ZodTypeAny, {
        type?: "none";
    }, {
        type?: "none";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"custom">;
        baseUrl: z.ZodString;
        apiKey: z.ZodString;
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type?: "custom";
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    }, {
        type?: "custom";
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"cloudbase">;
        provider: z.ZodString;
        model: z.ZodString;
        transformer: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type?: "cloudbase";
        transformer?: string;
        model?: string;
        provider?: string;
    }, {
        type?: "cloudbase";
        transformer?: string;
        model?: string;
        provider?: string;
    }>]>;
}, {
    name: string;
    value: string;
    configSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"none">;
    }, "strip", z.ZodTypeAny, {
        type?: "none";
    }, {
        type?: "none";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"custom">;
        apiKey: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type?: "custom";
        apiKey?: string;
    }, {
        type?: "custom";
        apiKey?: string;
    }>]>;
}, {
    name: string;
    value: string;
    configSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"none">;
    }, "strip", z.ZodTypeAny, {
        type?: "none";
    }, {
        type?: "none";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"custom">;
        baseUrl: z.ZodString;
        apiKey: z.ZodString;
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type?: "custom";
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    }, {
        type?: "custom";
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"cloudbase">;
        provider: z.ZodString;
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type?: "cloudbase";
        model?: string;
        provider?: string;
    }, {
        type?: "cloudbase";
        model?: string;
        provider?: string;
    }>]>;
}, {
    name: string;
    value: string;
    configSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"none">;
    }, "strip", z.ZodTypeAny, {
        type?: "none";
    }, {
        type?: "none";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"custom">;
        baseUrl: z.ZodString;
        apiKey: z.ZodString;
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type?: "custom";
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    }, {
        type?: "custom";
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"cloudbase">;
        provider: z.ZodString;
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type?: "cloudbase";
        model?: string;
        provider?: string;
    }, {
        type?: "cloudbase";
        model?: string;
        provider?: string;
    }>]>;
}, {
    name: string;
    value: string;
    configSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"custom">;
        baseUrl: z.ZodString;
        apiKey: z.ZodString;
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type?: "custom";
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    }, {
        type?: "custom";
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"cloudbase">;
        provider: z.ZodString;
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type?: "cloudbase";
        model?: string;
        provider?: string;
    }, {
        type?: "cloudbase";
        model?: string;
        provider?: string;
    }>]>;
}, {
    name: string;
    value: string;
    configSchema: z.ZodObject<{
        type: z.ZodLiteral<"none">;
    }, "strip", z.ZodTypeAny, {
        type?: "none";
    }, {
        type?: "none";
    }>;
}, {
    name: string;
    value: string;
}];
export declare const CLOUDBASE_PROVIDERS: readonly [{
    readonly name: "Kimi";
    readonly value: "kimi-exp";
    readonly models: readonly ["kimi-k2-instruct-local"];
    readonly transformer: any;
}, {
    readonly name: "DeepSeek";
    readonly value: "deepseek";
    readonly models: readonly ["deepseek-v3"];
    readonly transformer: "deepseek";
}, {
    readonly name: "LongCat";
    readonly value: "longcat";
    readonly models: readonly ["LongCat-Flash-Chat"];
    readonly transformer: any;
}];
export declare function getDefaultConfig(agent: string): unknown;
export declare function getAgentConfigValidator(agent: string): (x: unknown) => {
    success: true;
} | {
    success: false;
    error: unknown;
};
export declare const BASE_URL_MODEL_MAPPING: {
    readonly 'https://api.moonshot.cn/v1': "kimi-k2-0711-preview";
    readonly 'https://open.bigmodel.cn/api/paas/v4': "glm-4.5";
    readonly 'https://api.longcat.chat/openai': "LongCat-Flash-Chat";
};
export declare function getDefaultModelByBaseUrl(baseUrl: string): string;
export declare function getBooleanHint(defaultValue?: boolean): string;
export declare const LIST_HINT = "\u4F7F\u7528\u4E0A\u4E0B\u952E\u9009\u62E9\uFF0C\u6309\u4E0B Enter \u952E\u786E\u8BA4\u9009\u9879";
