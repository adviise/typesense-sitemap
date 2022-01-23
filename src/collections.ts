import type { DocumentsExportParameters } from 'typesense/lib/Typesense/Documents';
import { getClient } from './typesenseClient';

export const getCollection = async (collectionName: string) => {
    const client = getClient();
    return client.collections(collectionName).retrieve();
};

export const getCollectionStream = async (
    collectionName: string,
    params?: DocumentsExportParameters
) => {
    const client = getClient();
    const stream = await client
        .collections(collectionName)
        .documents()
        .exportStream(params);
    const totalDocuments = (await getCollection(collectionName)).num_documents;
    return {
        totalDocuments,
        stream,
    };
};
