# Typesense Sitemap Generator

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/4acbfa496cf94023b264b513039d25c8)](https://www.codacy.com/gh/Adviise/typesense-sitemap/dashboard?utm_source=github.com&utm_medium=referral&utm_content=Adviise/typesense-sitemap&utm_campaign=Badge_Grade)

This is a node library allowing you to generate sitemaps from a Typesense collection. It originally started as a fork of [algolia-sitemap](https://github.com/algolia/algolia-sitemap), but ended up becoming a complete rewrite due to the ways Typesense and Algolia differ in exporting data.

> Requires node v12+.

It will create sitemaps in a directory of your choosing (for example `/sitemaps`). For collections less than 50,000 records, it will generate a single sitemap at `/<output-dir>/sitemap.xml`. For collections larger than 50,000 records, it will generate multiple sitemaps (`/<output-dir>/sitemap.1.xml`, `/<output-dir>/sitemap.2.xml`, etc) and a root sitemap at `/<output-dir>/sitemap.xml` that you can give to Google to index all of the pages.

## Table of Contents

- [How does it work?](#how-does-it-work)
- [Usage](#usage)
    - [Getting Started](#getting-started)
    - [Transforming Documents](#transforming-documents)
    - [Filtering Results](#filtering-results)
- [Memory Considerations](#memory-considerations)
- [License](#license)
- [Contribution Guide](#contribution-guide)

## How does it work?

1. The entire Typesense collection is exported in a stream
2. Every [50,000](https://support.google.com/webmasters/answer/183668?hl=en) documents, a sitemap.n.xml is generated in the chosen directory (where n is the sitemap number)
3. Once all of the sitemaps have been generated, a final sitemap.xml is generated that links to all of the other xml files
4. Notify search engines know about the sitemap.xml either by [letting them know](https://support.google.com/webmasters/answer/183668?hl=en#addsitemap) or putting it in [robots.txt](https://support.google.com/webmasters/answer/183668?hl=en#addsitemap)

This process is a script that should be ran periodically to keep the sitemaps up to date.

## Usage

### Getting Started

First install the module from `npm` (or with `yarn`):

```sh
$ npm install typesense-sitemap --save[-dev]
$ yarn add typesense-sitemap [--dev]
```

Then bring the library into your project

```js
// Import statement
import typesenseSitemap from 'typesense-sitemap';
// CommonJS
const typesenseSitemap = require('typesense-sitemap').default;

typesenseSitemap({
    typesenseConfig: {
        apiKey: 'xxxxx', // must be an admin key
        nodes: [
            {
                host: 'xxxxx',
                port: 443,
                protocol: 'https',
            },
        ],
    },
    collectionName: 'xxxxx',
    sitemapLoc: 'https://www.mywebsite.com/<output-dir>',
    outputFolder: '<output-dir>',
    docTransformer: (doc) => {
        return {
            loc: `https://www.mywebsite.com/categories/${doc.name}`,
            lastmod: new Date().getTime(),
            priority: 0.8,
            changefreq: 'monthly',
        };
    },
    ////// optional params ///////
    params: {
        filter_by: '<any-filters-you-want>',
        include_fields: '<fields-to-include>',
        exclude_fields: '<fields-to-exclude>',
    },
    sitemapName: 'my-awesome-sitemap', // defaults to "sitemap"
    minifyOutput: true, // defaults to true
    emitLogs: true, // defaults to true
    linksPerSitemap: 50000, // default is 50,000. This value should not be greater than 50,000 as per Google's sitemap guidelines
});
```

### Transforming Documents

The `docTransformer` parameter is a function that transforms a collection document into a sitemap item. This function can return a sitemap item or `false`. Returning `false` will exclude that document from the sitemap. When returning a sitemap item the only required field is `loc`.

The `alternates.langToURL` parameter is a function that takes a language code and returns a url string for the alternate language URL. It can also return false to skip a particular language.

```js
function docTransformer(doc) {
    const loc = `https://www.yoursite.com/objects/${doc.id}`;
    const lastmod = new Date().toISOString();
    const priority = Math.random();
    return {
        loc, // only required field
        lastmod,
        priority,
        alternates: {
            languages: ['fr', 'pt-BR', 'zh-Hans'],
            langToURL: (lang) =>
                `https://www.yoursite.com/${lang}/objects/${doc.id}`,
        },
        images: [
            {
                loc: doc.photo,
                title: doc.photoTitle,
            },
        ],
    };
}
```

#### `SitemapItem` Fields

The docTransformer method should always return a `SitemapItem` or `false` (to skip that document in the sitemap). You can find the type definition for `SitemapItem` below.

```ts
interface SitemapItem {
    // URL of the page
    loc: string;
    // when the page was last modified. Accepts a date, ISO date string, or milliseconds
    lastmod?: Date | number | string;
    // how often the page changes
    changefreq?:
        | 'always'
        | 'hourly'
        | 'daily'
        | 'weekly'
        | 'monthly'
        | 'yearly'
        | 'never';
    // this page's priority (goes from 0 to 1). Default is 0.5
    priority?: number;
    // array of images related to this page (see typedef below)
    images?: SitemapItemImage[];
    // alternative versions of this page (useful for multi-lingual sites)
    alternates?: {
        // array of language codes that are enabled
        languages: string[];
        // function that takes a language code and returns the url of the translated page
        langToURL: (language: string) => string;
    };
}

// Typedef for SitemapItemImage
// For more information on images in sitemaps
// see https://support.google.com/webmasters/answer/178636?hl=en
interface SitemapItemImage {
    loc: string;
    title?: string;
    caption?: string;
    geo_location?: string;
    license?: string;
}
```

### Filtering Results

You can pass a `params` parameter to `typesenseSitemap`. This allows you to narrow down the outputed results. For a complete list of available params visit: [https://typesense.org/docs/0.21.0/api/documents.html#export-documents](https://typesense.org/docs/0.21.0/api/documents.html#export-documents)

```js
typesenseSitemap({
    // rest of config
    params: {
        filter_by: 'rating:>50',
        // be aware that this will affect data that is passed into docTransformer
        exclude_fields: 'photo,description',
    },
});
```

## Memory Considerations

When this script is running, up to 50,000 records will be stored in memory. For most users this is a non-issue since records are typically small. However, since Typesense has no limit on record sizes there's a feasible scenario where running this process creates memory issues. If you start running into this issue because you have large records you can use the `exclude_fields` or `include_fields` params to reduce the size of the data that is exported from Typesense.

```js
typsenseSitemap({
    /// rest of config
    params: {
        // only grab what you need for producing a sitemap
        include_fields: 'id,name,description',
    },
});
```

## License

MIT

## Contribution Guide

- Run `pnpm format` before submitting a PR
- CI will automatically run the linter and tests.
- If you are planning on adding a large feature open an issue first for discussion.
