import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enrichWithGeminiAi,
  extractWithGeminiFallback,
  resolveScraperAiModel,
  setCustomGeminiClientForTest,
} from './scraper';

test('Gemini Scraper Enrichment & Fallback Suite (server/scraper.ts)', async (t) => {
  const prevAiModel = process.env.AI_MODEL;
  const prevGeminiKey = process.env.GEMINI_API_KEY;
  const prevAiKey = process.env.AI_API_KEY;

  t.afterEach(() => {
    setCustomGeminiClientForTest(null);
    if (prevAiModel !== undefined) process.env.AI_MODEL = prevAiModel;
    else delete process.env.AI_MODEL;
    if (prevGeminiKey !== undefined) process.env.GEMINI_API_KEY = prevGeminiKey;
    else delete process.env.GEMINI_API_KEY;
    if (prevAiKey !== undefined) process.env.AI_API_KEY = prevAiKey;
    else delete process.env.AI_API_KEY;
  });

  await t.test('1. resolveScraperAiModel defaults to gemini-2.5-flash and respects AI_MODEL', () => {
    delete process.env.AI_MODEL;
    assert.equal(resolveScraperAiModel(), 'gemini-2.5-flash');

    process.env.AI_MODEL = 'gemini-2.5-flash';
    assert.equal(resolveScraperAiModel(), 'gemini-2.5-flash');

    process.env.AI_MODEL = '  gemini-2.5-pro  ';
    assert.equal(resolveScraperAiModel(), 'gemini-2.5-pro');
  });

  await t.test(
    '2. enrichWithGeminiAi calls @google/genai models.generateContent (not OpenAI fetch) and parses Moroccan COD JSON',
    async () => {
      process.env.AI_MODEL = 'gemini-2.5-flash';
      type CapturedCall = {
        model: string;
        contents: string;
        config?: {
          systemInstruction?: string;
          responseMimeType?: string;
          temperature?: number;
        };
      };
      const capturedCalls: CapturedCall[] = [];

      setCustomGeminiClientForTest({
        models: {
          generateContent: async (params) => {
            capturedCalls.push(params);
            return {
              text: JSON.stringify({
                title: 'خلاط محمول ذكي قابل للشحن USB-C',
                description: 'حضر عصائرك الطازجة في ثوانٍ مع توصيل سريع لجميع المدن المغربية.',
                features: ['ميزة 1', 'ميزة 2', 'ميزة 3', 'ميزة 4'],
                specifications: [
                  { label: 'السعة', value: '450 مل' },
                  { label: 'البطارية', value: '4000mAh' },
                  { label: 'ماذا يوجد في العلبة؟', value: 'الخلاط + كابل الشحن + دليل الاستخدام' },
                ],
                reviews: [
                  { author: 'سعيد العلمي', city: 'الدار البيضاء', rating: 5, comment: 'ممتاز جداً' },
                  { author: 'فاطمة الزهراء', city: 'الرباط', rating: 5, comment: 'توصيل سريع' },
                  { author: 'يوسف بنعلي', city: 'مراكش', rating: 5, comment: 'جودة أصلية' },
                ],
                faqs: [
                  { question: 'كم مدة التوصيل؟', answer: '24 إلى 48 ساعة' },
                  { question: 'هل الدفع عند الاستلام؟', answer: 'نعم بعد معاينة المنتج' },
                  { question: 'هل يوجد ضمان؟', answer: 'ضمان سنة كاملة' },
                ],
              }),
            };
          },
        },
      });

      const result = await enrichWithGeminiAi({
        title: 'Portable USB Blender',
        description: ' Rechargeable smoothie blender',
        platform: 'Shopify',
        niche: 'Kitchen & Home Gadgets',
        rawUrl: 'https://example-shop.ma/products/blender',
      });

      assert.equal(capturedCalls.length, 1, 'models.generateContent must be called');
      const capturedCall = capturedCalls[0];
      assert.equal(capturedCall.model, 'gemini-2.5-flash');
      assert.equal(capturedCall.config?.responseMimeType, 'application/json');
      assert.ok(capturedCall.config?.systemInstruction?.includes('COD'));
      assert.ok(result);
      assert.equal(result.title, 'خلاط محمول ذكي قابل للشحن USB-C');
      assert.equal(result.features?.length, 4);
      assert.equal(result.specifications?.length, 3);
      assert.equal(result.reviews?.length, 3);
      assert.equal(result.faqs?.length, 3);
    }
  );

  await t.test('3. enrichWithGeminiAi strips markdown code fences and returns null when no client/key', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.AI_API_KEY;
    setCustomGeminiClientForTest(null);

    const noKeyResult = await enrichWithGeminiAi({
      title: 'Test Product',
      description: 'Test',
      platform: 'YouCan',
      niche: 'Smart Gadgets & Electronics',
      rawUrl: 'https://youcan.shop/products/test',
    });
    assert.equal(noKeyResult, null);

    setCustomGeminiClientForTest({
      models: {
        generateContent: async () => ({
          text: '```json\n{"title":"منتج مغربي ممتاز","features":["أصلي 100%"]}\n```',
        }),
      },
    });

    const fencedResult = await enrichWithGeminiAi({
      title: 'Test Product',
      description: 'Test',
      platform: 'YouCan',
      niche: 'Smart Gadgets & Electronics',
      rawUrl: 'https://youcan.shop/products/test',
    });
    assert.ok(fencedResult);
    assert.equal(fencedResult.title, 'منتج مغربي ممتاز');
  });

  await t.test('4. extractWithGeminiFallback uses resolveScraperAiModel() and parses HTML fallback JSON', async () => {
    process.env.AI_MODEL = 'gemini-2.5-flash';
    let usedModel = '';

    setCustomGeminiClientForTest({
      models: {
        generateContent: async (params) => {
          usedModel = params.model;
          return {
            text: JSON.stringify([
              {
                title: 'ساعة ذكية رياضية',
                description: 'ساعة ذكية مقاومة للماء مع قياس نبضات القلب',
                price: 299,
                images: ['https://cdn.shopify.com/s/files/1/watch_800x800.jpg'],
                features: ['مقاومة للماء IP68', 'بطارية تدوم 7 أيام'],
                specifications: [{ label: 'الشاشة', value: 'AMOLED 1.43 inch' }],
              },
            ]),
          };
        },
      },
    });

    const extracted = await extractWithGeminiFallback(
      '<html><body><h1>ساعة ذكية رياضية</h1></body></html>',
      'https://example-shop.ma'
    );
    assert.equal(usedModel, 'gemini-2.5-flash');
    assert.ok(extracted);
    assert.equal(extracted.title, 'ساعة ذكية رياضية');
    assert.equal(extracted.price, 299);
    assert.equal(extracted.images?.length, 1);
  });
});
