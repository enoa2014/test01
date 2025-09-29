import { ISetProvisionedConcurrencyConfig, IGetProvisionedConcurrencyConfig, IGetProvisionedConcurrencyRes } from '../types';
export declare function setProvisionedConcurrencyConfig(options: ISetProvisionedConcurrencyConfig): Promise<void>;
export declare function getProvisionedConcurrencyConfig(options: IGetProvisionedConcurrencyConfig): Promise<IGetProvisionedConcurrencyRes>;
export declare function deleteProvisionedConcurrencyConfig(options: IGetProvisionedConcurrencyConfig): Promise<void>;
