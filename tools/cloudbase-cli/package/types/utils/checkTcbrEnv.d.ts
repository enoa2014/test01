import { EnumEnvCheck } from '../constant';
export declare function checkTcbrEnv(envId: string | undefined, isTcbr: boolean): Promise<EnumEnvCheck> | never;
export declare function logEnvCheck(envId: string, warningType: EnumEnvCheck): void;
