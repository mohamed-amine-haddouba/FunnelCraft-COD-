import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COUNTRIES_CITIES,
  getCountriesSorted,
  getCitiesForCountry,
  resolveCanonicalCountryKey,
} from './countriesCities';
import {
  normalizeHighResImageUrl,
  parseJsonLdFromHtml,
  extractGalleryImagesFromDom,
} from '../../server/scraper';

test('getCountriesSorted returns non-empty alphabetically sorted list of countries', () => {
  const countries = getCountriesSorted();
  assert.ok(countries.length >= 15, 'Should contain at least 15 countries');
  const sortedCopy = [...countries].sort((a, b) => a.key.localeCompare(b.key));
  assert.deepEqual(countries, sortedCopy);
});

test('getCitiesForCountry returns empty array when no country selected and sorted cities when country selected', () => {
  assert.deepEqual(getCitiesForCountry(''), []);
  assert.deepEqual(getCitiesForCountry(undefined), []);

  const moroccoCities = getCitiesForCountry('المغرب (Morocco)');
  assert.ok(moroccoCities.length >= 10, 'Morocco should have at least 10 cities');
  const sortedMorocco = [...moroccoCities].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(moroccoCities, sortedMorocco);
});

test('resolveCanonicalCountryKey resolves exact, Arabic, and English country names', () => {
  assert.equal(resolveCanonicalCountryKey('المغرب (Morocco)'), 'Morocco');
  assert.equal(resolveCanonicalCountryKey('Morocco'), 'Morocco');
  assert.equal(resolveCanonicalCountryKey('MA'), 'Morocco');
  assert.ok(COUNTRIES_CITIES[resolveCanonicalCountryKey('UAE')].length > 0);
});

test('normalizeHighResImageUrl filters out icons/logos and upgrades Shopify/AliExpress thumbnail dimensions', () => {
  assert.equal(normalizeHighResImageUrl('https://cdn.shop.com/logo.svg', 'https://cdn.shop.com'), null);
  assert.equal(
    normalizeHighResImageUrl('https://cdn.shop.com/payment-badge-16x16.png', 'https://cdn.shop.com'),
    null
  );

  const shopifyThumb = 'https://cdn.shopify.com/s/files/1/0001/products/watch_300x300.jpg';
  const highResShopify = normalizeHighResImageUrl(shopifyThumb, 'https://cdn.shopify.com');
  assert.equal(highResShopify, 'https://cdn.shopify.com/s/files/1/0001/products/watch.jpg');

  const aliThumb = 'https://ae01.alicdn.com/kf/S12345.jpg_50x50.jpg';
  const highResAli = normalizeHighResImageUrl(aliThumb, 'https://ae01.alicdn.com');
  assert.equal(highResAli, 'https://ae01.alicdn.com/kf/S12345.jpg');
});

test('Layer 1 & Layer 2 scraper extract Product JSON-LD and gallery images', () => {
  const sampleHtml = `
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": "Smart Watch Ultra Max",
            "description": "Full high-resolution AMOLED display with waterproof casing and 7-day battery life.",
            "image": [
              "https://cdn.shopify.com/s/files/1/watch_main_400x400.jpg",
              "https://cdn.shopify.com/s/files/1/watch_side_400x400.jpg"
            ],
            "offers": {
              "@type": "Offer",
              "price": "299",
              "priceCurrency": "MAD"
            }
          }
        </script>
      </head>
      <body>
        <div class="product-gallery">
          <img src="https://cdn.shopify.com/s/files/1/watch_main_400x400.jpg" />
          <img data-zoom-image="https://cdn.shopify.com/s/files/1/watch_back_1200x1200.jpg" />
          <div class="swiper-slide">
            <img data-src="https://cdn.shopify.com/s/files/1/watch_lifestyle_600x600.jpg" />
          </div>
        </div>
      </body>
    </html>
  `;

  const layer1 = parseJsonLdFromHtml(sampleHtml, 'https://example.com');
  assert.equal(layer1.title, 'Smart Watch Ultra Max');
  assert.equal(layer1.price, 299);
  assert.equal(layer1.images?.length, 2);

  const layer2Images = extractGalleryImagesFromDom(sampleHtml, 'https://example.com');
  assert.ok(layer2Images.length >= 3, 'Should extract unique high-res gallery images from DOM');
});
