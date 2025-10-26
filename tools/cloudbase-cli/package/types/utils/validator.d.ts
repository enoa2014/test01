type SimpleValue = number | string | boolean;
export declare function assertTruthy(val: SimpleValue | SimpleValue[], errMsg: string): void;
export declare function assertHas(obj: any, prop: string, errMsg: any): void;
export declare const validateIp: (ip: string) => boolean;
export declare const validateCpuMem: (cpuInput: number | string | undefined, memInput: number | string | undefined) => {
    cpuOutput: number;
    memOutput: number;
};
export {};
