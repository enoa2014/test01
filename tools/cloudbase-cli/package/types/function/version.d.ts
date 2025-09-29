import { IPublishVersionParams, IListFunctionVersionParams, IFunctionVersionsRes } from '../types';
export declare function publishVersion(options: IPublishVersionParams): Promise<void>;
export declare function listFunctionVersions(options: IListFunctionVersionParams): Promise<IFunctionVersionsRes>;
