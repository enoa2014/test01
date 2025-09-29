import { type JSONSchema } from 'json-schema-to-typescript';
export declare function generateDataModelDTS(dataModelList: {
    name: string;
    title: string;
    schema: JSONSchema;
}[]): Promise<string>;
