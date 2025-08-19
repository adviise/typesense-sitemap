import { createReadStream, ReadStream, writeFile } from 'fs-extra';
import jsonlines from 'jsonlines';
import builder from 'xmlbuilder';
import cliProgressBar from 'cli-progress';
import { getLogEmitStatus, log } from './logger';

export type ChangeFrequency =
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';

export interface SitemapItemImage {
    loc: string;
    title?: string;
    caption?: string;
    geo_location?: string;
    license?: string;
}

export interface SitemapItem {
    /**
     * The url of the page
     */
    loc: string;
    /**
     * When the page was last modified. This property accepts a date object, milliseconds, or an ISO date string
     */
    lastmod?: Date | number | string;
    /**
     * How frequently this page is changed
     */
    changefreq?: ChangeFrequency;
    /**
     * How much priority you want to give this page. Value goes from 0 to 1 (Default is 0.5)
     */
    priority?: number;
    images?: SitemapItemImage[];
    /**
     * Used for providing alternates of this page in different languages
     */
    alternates?: {
        languages: string[];
        langToURL: (language: string) => string | false;
    };
}

export type DocTransformer<T = any> = (hit: T) => SitemapItem | false;

export const createSitemapItemElement = (
    item: SitemapItem
): builder.XMLElement => {
    const { loc, lastmod, changefreq, priority, alternates, images } = item;
    const urlEl = builder.create('url');
    urlEl.ele('loc', {}, loc);
    urlEl.ele('priority', {}, priority || 0.5);
    if (lastmod) {
        switch (typeof lastmod) {
            case 'object':
                urlEl.ele('lastmod', {}, lastmod.toISOString());
                break;
            case 'number': {
                const date = new Date(lastmod);
                urlEl.ele('lastmod', {}, date.toISOString());
                break;
            }
            case 'string': {
                const date = new Date(Date.parse(lastmod));
                urlEl.ele('lastmod', {}, date.toISOString());
                break;
            }
            default:
                break;
        }
    }
    if (changefreq) {
        urlEl.ele('changefreq', {}, changefreq);
    }
    if (alternates) {
        for (const lang of alternates.languages) {
            const href = alternates.langToURL(lang);
            if (href) {
                urlEl.ele('xhtml:link', {
                    rel: 'alternate',
                    hreflang: lang,
                    href,
                });
            }
        }
    }
    if (images) {
        for (const image of images) {
            const imageEl = urlEl.ele('image:image');
            imageEl.ele('image:loc', {}, image.loc);
            if (image.title) imageEl.ele('image:title', {}, image.title);
            if (image.caption) imageEl.ele('image:caption', {}, image.caption);
            if (image.geo_location)
                imageEl.ele('image:geo_location', {}, image.geo_location);
            if (image.license) imageEl.ele('image:license', {}, image.license);
        }
    }
    return urlEl;
};

export const generateSitemap = async (
    items: SitemapItem[],
    sitemapIndex: number,
    sitemapName: string,
    outputFolder: string,
    minifyOutput: boolean,
    ignoreIndex = false
) => {
    const root = builder.create('urlset', { encoding: 'utf-8' });
    root.attribute('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9');

    let isMultilingual = false;
    let containsImages = false;
    for (const item of items) {
        root.children.push(createSitemapItemElement(item));
        if (item.alternates) isMultilingual = true;
        if (item.images) containsImages = true;
    }

    if (isMultilingual)
        root.attribute('xmlns:xhtml', 'http://www.w3.org/1999/xhtml');
    if (containsImages)
        root.attribute(
            'xmlns:image',
            'http://www.google.com/schemas/sitemap-image/1.1'
        );

    const finalOutput = root.end({ pretty: !minifyOutput });
    const fileName = ignoreIndex
        ? `${sitemapName}.xml`
        : `${sitemapName}.${sitemapIndex + 1}.xml`;
    await writeFile(`${outputFolder}/${fileName}`, finalOutput);
};

export const createSitemapIndexElement = (
    sitemapLoc: string,
    sitemapIndex: number,
    lastmod: Date,
    sitemapName: string
) => {
    const sitemapEl = builder.create('sitemap');
    sitemapEl.ele('loc', {}, `${sitemapLoc}/${sitemapName}.${sitemapIndex + 1}.xml`);
    sitemapEl.ele('lastmod', {}, lastmod.toISOString());
    return sitemapEl;
};

export const generateSitemapIndex = async (
    sitemapCount: number,
    sitemapLoc: string,
    sitemapName: string,
    outputFolder: string,
    minifyOutput: boolean
) => {
    const now = new Date();
    const root = builder.create('sitemapindex', { encoding: 'utf-8' });
    root.attribute('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9');
    for (let i = 0; i < sitemapCount; i++) {
        root.children.push(createSitemapIndexElement(sitemapLoc, i, now, sitemapName));
    }
    const finalOutput = root.end({ pretty: !minifyOutput });
    await writeFile(`${outputFolder}/${sitemapName}.xml`, finalOutput);
};

export const generateSitemapsFromStream = (
    stream: ReadStream,
    docTransformer: DocTransformer,
    totalDocuments: number,
    sitemapLoc: string,
    sitemapName: string,
    outputFolder: string,
    minifyOutput: boolean,
    linksPerSitemap = 50000
) => {
    const bar = new cliProgressBar.SingleBar(
        { format: '{bar} {percentage}% | {value}/{total}', hideCursor: true },
        cliProgressBar.Presets.shades_classic
    );
    log('generating sitemaps...');
    let currentSitemapIndex = 0;
    let sitemapItems: SitemapItem[] = [];
    const parser = jsonlines.parse();
    stream.pipe(parser);
    const showProgressBar = getLogEmitStatus();
    if (showProgressBar) {
        bar.start(totalDocuments, 0);
    }
    return new Promise((resolve, reject) => {
        parser.on('data', async (data) => {
            const sitemapItem = docTransformer(data);
            if (sitemapItem) {
                sitemapItems.push(sitemapItem);
            }
            bar.increment(1);
            if (sitemapItems.length === linksPerSitemap) {
                parser.pause();
                await generateSitemap(
                    sitemapItems,
                    currentSitemapIndex,
                    sitemapName,
                    outputFolder,
                    minifyOutput
                );
                currentSitemapIndex++;
                sitemapItems = [];
                parser.resume();
            }
        });
        parser.on('error', (err) => {
            reject(err);
        });
        parser.on('end', async () => {
            const ignoreIndex = currentSitemapIndex === 0;
            if (sitemapItems.length) {
                await generateSitemap(
                    sitemapItems,
                    currentSitemapIndex,
                    sitemapName,
                    outputFolder,
                    minifyOutput,
                    ignoreIndex
                );
            }
            bar.stop();
            if (!ignoreIndex) {
                await generateSitemapIndex(
                    currentSitemapIndex + 1,
                    sitemapLoc,
                    sitemapName,
                    outputFolder,
                    minifyOutput
                );
            }
            resolve(true);
        });
    });
};

export const generateSitemaps = async (
    docTransformer: DocTransformer,
    tempFile: string,
    sitemapLoc: string,
    sitemapName: string,
    outputFolder: string,
    minifyOutput: boolean,
    linksPerSitemap: number
) => {
    const stream = createReadStream(tempFile);
    await generateSitemapsFromStream(
        stream,
        docTransformer,
        10000,
        sitemapLoc,
        sitemapName,
        outputFolder,
        minifyOutput,
        linksPerSitemap
    );
};
