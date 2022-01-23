import { Client } from 'typesense';
import { ConfigurationOptions } from 'typesense/lib/Typesense/Configuration';

let tsConfig: null | ConfigurationOptions = null;

export const getClient = () => {
    if (!tsConfig) {
        throw new Error(
            'Client not initialized run initClient() before calling this function'
        );
    }
    const client = new Client(tsConfig);
    return client;
};

export const initClient = (config: ConfigurationOptions) => {
    tsConfig = config;
    return getClient();
};
