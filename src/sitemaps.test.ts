import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import {
    remove,
    writeFile,
    createReadStream,
    ensureDir,
    readFile,
} from 'fs-extra';
import { faker } from '@faker-js/faker';
import {
    createSitemapItemElement,
    SitemapItem,
    generateSitemapsFromStream,
} from './sitemaps';

const testWebsite = `https://mywebsite.com`;
const parser = new XMLParser({ ignoreAttributes: false });
const sitemapDir = '__temp__/sitemaps';
const tmpFile = `./__temp__/sitemaps/.testdata.jsonl`;
const tmpFileItemCount = 10500;

interface DummyEntry {
    id: string;
    name: string;
    photo?: string;
    photoTitle?: string;
}

const createTempFile = async (totalItems: number) => {
    let fileContent = '';
    for (let i = 0; i < totalItems; i++) {
        const entry: DummyEntry = {
            id: faker.string.uuid(),
            name: `${faker.person.firstName()} ${faker.person.lastName()}`,
            photo: faker.image.url(),
            photoTitle: faker.lorem.sentence(),
        };
        fileContent += `${JSON.stringify(entry)}\n`;
    }
    await writeFile(tmpFile, fileContent);
};

beforeAll(async () => {
    await ensureDir(sitemapDir);
    await createTempFile(tmpFileItemCount);
});

afterAll(async () => {
    await remove(sitemapDir);
});

describe('createSitemapItemElement', () => {
    test('URL with loc only', () => {
        const item: SitemapItem = {
            loc: `${testWebsite}/users/john-doe`,
        };
        const el = createSitemapItemElement(item);
        const result = parser.parse(el.end());
        const { url } = result;
        expect(url).toStrictEqual({
            loc: item.loc,
            priority: 0.5,
        });
    });
    test('URL with alternates', () => {
        const item: SitemapItem = {
            loc: `${testWebsite}/blog/my-slug`,
            alternates: {
                languages: ['en', 'fr', 'de'],
                langToURL: (lang) => {
                    if (lang === 'en') {
                        return false;
                    }
                    return `${testWebsite}/${lang}/blog/my-slug`;
                },
            },
        };
        const el = createSitemapItemElement(item);
        const result = parser.parse(el.end());
        expect(result.url['xhtml:link'].length).toBe(2);
        expect(result.url).toStrictEqual({
            loc: item.loc,
            priority: 0.5,
            'xhtml:link': [
                {
                    '@_rel': 'alternate',
                    '@_hreflang': 'fr',
                    '@_href': `${testWebsite}/fr/blog/my-slug`,
                },
                {
                    '@_rel': 'alternate',
                    '@_hreflang': 'de',
                    '@_href': `${testWebsite}/de/blog/my-slug`,
                },
            ],
        });
    });
    test('URL with images', () => {
        const item: SitemapItem = {
            loc: `${testWebsite}/gallery/1`,
            priority: 0.85,
            images: [
                {
                    loc: `${testWebsite}/images/1.jpg`,
                    title: 'My first ever image',
                },
                {
                    loc: `${testWebsite}/images/2.jpg`,
                },
                {
                    loc: `${testWebsite}/images/3.jpg`,
                    title: 'My Third Image',
                    caption: "There's something happening here",
                    geo_location: 'Dallas, TX',
                    license: 'N/A',
                },
            ],
        };
        const el = createSitemapItemElement(item);
        const { url } = parser.parse(el.end());
        expect(Array.isArray(url['image:image'])).toBe(true);
        expect(url['image:image'].length).toBe(3);
        expect(url).toStrictEqual({
            loc: item.loc,
            priority: 0.85,
            'image:image': [
                {
                    'image:loc': `${testWebsite}/images/1.jpg`,
                    'image:title': 'My first ever image',
                },
                {
                    'image:loc': `${testWebsite}/images/2.jpg`,
                },
                {
                    'image:loc': `${testWebsite}/images/3.jpg`,
                    'image:title': 'My Third Image',
                    'image:caption': "There's something happening here",
                    'image:geo_location': 'Dallas, TX',
                    'image:license': 'N/A',
                },
            ],
        });
    });
});

describe('Create Sitemaps', () => {
    test('No Images or Alts', async () => {
        const stream = createReadStream(tmpFile);
        const docTransformer = (doc: DummyEntry) => ({
            loc: doc.id,
            priority: doc.photo ? 0.85 : 0.5,
        });
        await generateSitemapsFromStream(
            stream,
            docTransformer,
            tmpFileItemCount,
            `${testWebsite}/sitemaps`,
            `test-sitemap`,
            sitemapDir,
            true,
            1000
        );
        const sitemapIndex = await readFile(`${sitemapDir}/test-sitemap.xml`);
        const parsedIndex = parser.parse(sitemapIndex).sitemapindex;
        expect(parsedIndex.sitemap.length).toBe(11);
        const firstSitemap = parser.parse(
            await readFile(`${sitemapDir}/test-sitemap.1.xml`)
        ).urlset;
        expect(firstSitemap.url.length).toBe(1000);
        expect(firstSitemap['@_xmlns']).toBe(
            'http://www.sitemaps.org/schemas/sitemap/0.9'
        );
        const lastSitemap = parser.parse(
            await readFile(`${sitemapDir}/test-sitemap.11.xml`)
        ).urlset;
        expect(lastSitemap.url.length).toBe(500);
    });
    test('Has Images and Alts', async () => {
        const stream = createReadStream(tmpFile);
        const docTransformer = (doc: DummyEntry) => {
            const final: SitemapItem = {
                loc: `${testWebsite}/${doc.id}`,
                alternates: {
                    languages: ['en', 'fr'],
                    langToURL: (lang) => `${testWebsite}/${lang}/${doc.id}`,
                },
            };
            if (doc.photo && doc.photoTitle) {
                final.images = [
                    {
                        loc: doc.photo,
                        title: doc.photoTitle,
                    },
                ];
            }
            return final;
        };
        await ensureDir(sitemapDir);
        await generateSitemapsFromStream(
            stream,
            docTransformer,
            tmpFileItemCount,
            `${testWebsite}/sitemaps`,
            `test-sitemap`,
            sitemapDir,
            true,
            1000
        );
        const firstSitemap = parser.parse(
            await readFile(`${sitemapDir}/test-sitemap.1.xml`)
        ).urlset;
        expect(firstSitemap['@_xmlns:xhtml']).toBe(
            'http://www.w3.org/1999/xhtml'
        );
        expect(firstSitemap['@_xmlns:image']).toBe(
            'http://www.google.com/schemas/sitemap-image/1.1'
        );
    });
});
