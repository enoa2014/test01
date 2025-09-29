declare class BeaconAction {
    private deviceId;
    private userAgent;
    private additionalParams;
    constructor();
    private getUserAgent;
    private getDeviceId;
    report(eventCode: string, eventData?: {
        [key: string]: any;
    }): Promise<any>;
    addAdditionalParams(params: {
        [key: string]: any;
    }): void;
}
export declare const beaconAction: BeaconAction;
export {};
