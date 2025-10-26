/// <reference types="node" />
import { ChildProcess } from 'child_process';
export declare function promisifyProcess(p: ChildProcess, pipe?: boolean): Promise<unknown>;
export declare function getLowcodeCli(): Promise<typeof import('@cloudbase/lowcode-cli')>;
export declare function getCmdConfig(config: any, options: {
    cmd: string;
    childCmd: string;
}): any;
export declare function getMergedOptions(config?: {}, argOptions?: {}): any;
