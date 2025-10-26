/// <reference types="node" />
import { EventEmitter } from 'events';
import { ICommandContext } from '../types';
interface ICommandOption {
    flags: string;
    desc: string;
    hideHelp?: boolean;
}
export interface ICommandOptions {
    deprecateCmd?: string;
    cmd: string;
    allowUnknownOption?: boolean;
    childCmd?: string | {
        cmd: string;
        desc: string;
    };
    childSubCmd?: string;
    options: ICommandOption[];
    desc: string;
    requiredEnvId?: boolean;
    withoutAuth?: boolean;
    autoRunLogin?: boolean;
}
interface ICommandDecoratorOptions {
    supportPrivate: boolean | 'only';
}
export declare function ICommand(options?: ICommandDecoratorOptions): ClassDecorator;
export declare function registerCommands(): Promise<void>;
export declare abstract class Command extends EventEmitter {
    on(event: 'preHandle' | 'afterHandle', listener: (ctx: ICommandContext, args: any[]) => void): this;
    init(): void;
    private createProgram;
    private preHandle;
    private afterHandle;
    abstract execute(...args: any[]): void;
    abstract get options(): ICommandOptions;
}
export {};
