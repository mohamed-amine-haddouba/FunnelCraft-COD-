import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldUseScrapedProductTemplate } from './publicPageRendering';

test('published edited imported pages render merchant-customized blocks, not legacy storefront', () => {
  assert.equal(shouldUseScrapedProductTemplate({
    scrapedData: { title: 'Imported product' },
    blocks: [{ id: 'hero-1', type: 'hero' }],
  } as any), false);
});

test('legacy scraped-only pages still render the original product storefront', () => {
  assert.equal(shouldUseScrapedProductTemplate({ scrapedData: { title: 'Legacy product' }, blocks: [] } as any), true);
  assert.equal(shouldUseScrapedProductTemplate({ scrapedData: { title: 'Legacy product' } } as any), true);
});

test('regular block-based pages do not use the scraped storefront', () => {
  assert.equal(shouldUseScrapedProductTemplate({ blocks: [{ id: 'hero-1', type: 'hero' }] } as any), false);
});
