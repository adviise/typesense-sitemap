import type { ConfigurationOptions } from 'typesense/lib/Typesense/Configuration';
import type { DocumentsExportParameters } from 'typesense/lib/Typesense/Documents';
import { ensureDir } from 'fs-extra';
import { getCollectionStream } from './collections';
import { initClient } from './typesenseClient';
import { initLogger } from './logger';
import { DocTransformer, generateSitemapsFromStream } from './sitemaps';

export { DocTransformer, SitemapItem, SitemapItemImage } from './sitemaps';

export interface TypesenseSitemapConfig {
    typesenseConfig: ConfigurationOptions;
    /**
     * The name of the collection you want to export from
     */
    collectionName: string;
    /**
     * Typesense export params
     */
    params?: DocumentsExportParameters;
    /**
     * Base web url that your sitemaps will be located at
     */
    sitemapLoc: string;
    /**
     * The filename of your sitemap(s) (Default is "sitemap")
     */
    sitemapName?: string;
    /**
     * Folder you want to output the xml files to
     */
    outputFolder: string;
    /**
     * Function that transforms a typesense record into the desired sitemap parameters
     */
    docTransformer: DocTransformer;
    /**
     * Setting to true will minify the output (Default is true)
     */
    minifyOutput?: boolean;
    emitLogs?: boolean;
    /**
     * Default is 50,000 which is the max allowed in Google's guidelines.
     */
    linksPerSitemap?: number;
}

const typesenseSitemap = async ({
    typesenseConfig,
    collectionName,
    params,
    sitemapLoc,
    sitemapName = 'sitemap',
    outputFolder,
    docTransformer,
    minifyOutput = true,
    emitLogs = true,
    linksPerSitemap = 50000,
}: TypesenseSitemapConfig) => {
    initLogger(emitLogs);
    const client = initClient(typesenseConfig);
    const collectionExists = await client.collections(collectionName).exists();
    if (!collectionExists) {
        throw new Error(`Collection ${collectionName} doesn't exist`);
    }
    await ensureDir(outputFolder);
    const collectionStream = await getCollectionStream(collectionName, params);
    await generateSitemapsFromStream(
        collectionStream.stream,
        docTransformer,
        collectionStream.totalDocuments,
        sitemapLoc,
        sitemapName,
        outputFolder,
        minifyOutput,
        linksPerSitemap
    );
};

export default typesenseSitemap;
