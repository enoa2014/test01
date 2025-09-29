import { IUpdateFunctionAliasConfig, IGetFunctionAlias, IGetFunctionAliasRes } from '../types';
export declare function setFunctionAliasConfig(options: IUpdateFunctionAliasConfig): Promise<void>;
export declare function getFunctionAliasConfig(options: IGetFunctionAlias): Promise<IGetFunctionAliasRes>;
