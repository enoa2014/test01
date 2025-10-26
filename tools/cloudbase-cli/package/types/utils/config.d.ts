import { Arguments } from 'yargs';
import { ICloudBaseConfig } from '@cloudbase/toolbox';
import { Credential } from '../types';
export interface IArgs {
    envId: string;
    region: string;
    verbose: boolean;
    configPath: string;
    [x: string]: unknown;
}
export declare const getArgs: () => Arguments<IArgs>;
export declare function getPrivateSettings(config: ICloudBaseRcSettings, cmd?: string): undefined | IPrivateSettings;
type IAbsUrl = `http://${string}` | `https://${string}`;
export interface IPrivateSettings {
    credential: Credential;
    endpoints: {
        editor: IAbsUrl;
        cliApi: IAbsUrl;
    };
    privateUin: string;
}
export interface ICloudBaseRcSettings extends ICloudBaseConfig {
    privateSettings?: IPrivateSettings;
    ai?: any;
}
export declare const getCloudBaseConfig: (configPath?: string) => Promise<ICloudBaseRcSettings>;
export {};
