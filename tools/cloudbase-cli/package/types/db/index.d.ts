export declare function listModels(options?: {
    envId?: string;
    name?: string[];
}): Promise<any[]>;
export declare function createModel({ envId, name, title, schema }: {
    envId: string;
    name: string;
    title: string;
    schema: any;
}): Promise<any>;
export declare function updateModel({ envId, id, title, schema }: {
    envId: string;
    id: string;
    title: string;
    schema: any;
}): Promise<any>;
export declare function getModel(options: {
    envId: string;
    name: string;
}): Promise<any>;
export declare function publishModel(options: {
    envId: string;
    ids: string[];
}): Promise<any>;
