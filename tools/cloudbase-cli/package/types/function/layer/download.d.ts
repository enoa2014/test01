export interface ILayerDownloadOptions {
    name: string;
    version: number;
    destPath: string;
    force?: boolean;
}
export declare function downloadLayer(options: ILayerDownloadOptions): Promise<void>;
