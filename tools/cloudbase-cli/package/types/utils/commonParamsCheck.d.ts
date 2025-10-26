import { ITcbrServiceOptionalOptions, ITcbrServiceConvertedOptionalOptions } from '../types';
export declare function parseOptionalParams(options: ITcbrServiceOptionalOptions): ITcbrServiceConvertedOptionalOptions;
export declare function parseInputParam(originalParam: any, override: boolean, handler: Function | null, overrideVal: any, defaultVal: any, ...args: any[]): any;
