import _fetch, { RequestInit } from 'node-fetch';
type fetchReturnType = ReturnType<typeof _fetch>;
type UnPromisify<T> = T extends PromiseLike<infer U> ? U : T;
type fetchReturnTypeExtracted = UnPromisify<fetchReturnType>;
export declare function fetch(url: string, config?: RequestInit): Promise<any>;
export declare function postFetch(url: string, data?: Record<string, any>): Promise<any>;
export declare function fetchStream(url: any, config?: Record<string, any>): Promise<fetchReturnTypeExtracted>;
export {};
