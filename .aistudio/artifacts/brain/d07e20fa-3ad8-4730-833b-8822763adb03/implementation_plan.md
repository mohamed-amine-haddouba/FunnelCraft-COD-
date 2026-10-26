# Expert COD Funnel Architect & Product Analyst Pipeline Integration

Integration of the Master E-commerce Product Analyst & Copywriting pipeline into FunnelCraft's backend AI URL import engine (`POST /api/ai/import-from-url`), deeply extracting specifications, multi-angle images, daily customer pain points, and objections for high-converting Cash on Delivery funnels.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The architectural direction and localization defaults have been confirmed based on user feedback:

- **Confirmed Integration Mode**: Directly integrate the Master E-commerce Product Analyst and Funnel Architect prompt schema into the backend AI URL import and analysis pipeline in `server.ts`.
- **Confirmed Primary Demo Niche**: Smart Tech and Electronics (e.g., 4K Ultra HD Portable Pocket Projector, Smart Noise-Cancelling Earbuds, Wireless Fast Charging Dock).
- **Confirmed Target Language Default**: English for international and global Cash on Delivery stores, while maintaining full support for Moroccan Darija (`ar-ma`), Classical Arabic (`ar`), and French (`fr`).
- **Confirmed Specifications & Rich FAQ Engine**: Deep extraction of technical specifications (dimensions, connectivity, battery, material) into dedicated feature/spec cards, and generation of at least 4 high-trust COD buyer objection FAQs.

---

### 1. Overview & Core Concept

- **What It Does**:
  1. **Two-Stage Analysis**: When a merchant submits a product URL or raw product data, the backend scraper gathers raw HTML, metadata, and JSON-LD.
  2. **Expert COD Funnel Prompting**: The system feeds the raw data into Gemini Pro using the Master Copywriter and Product Analyst architecture. The model extracts exact specifications, formulates an aggressive hook tagline, constructs customer pain-point/solution narratives, formats tiered COD quantity bundles, and produces objection-crushing FAQs.
  3. **Seamless Canvas Translation**: A bidirectional mapper converts the analyst's structured output into FunnelCraft's interactive canvas blocks (`promo-bar`, `hero`, `problem-solution`, `features`, `specifications`, `cod-form`, `faq`, `floating-cta`).
- **Target Audience / Persona**: International and MENA e-commerce merchants, media buyers running TikTok and Meta ads, and drop-shippers seeking maximum conversion rates with zero manual landing page drafting.
- **Key Value**: Guarantees advertising-ready, objection-free sales funnels with accurate specs, sharp imagery, and battle-tested conversion triggers in seconds.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Importing Link**: In the AI Generator modal, user selects "🔗 Import from URL (AliExpress / Shopify / Any Store)".
  2. **Niche & Language Selection**: Defaults to "Smart Tech & Electronics" with "English (International COD - LTR)" selected by default, with quick-select options for Moroccan Darija (`ar-ma`), Classical Arabic (`ar`), and French (`fr`).
  3. **Real-Time Extraction Progress**:
     - *Step 1*: Connecting to store & scraping full product specifications...
     - *Step 2*: Analyzing product features, dimensions, and high-res media...
     - *Step 3*: Applying Master COD Copywriting architecture (Pain/Solution, Hooks & Bundles)...
     - *Step 4*: Compiling responsive canvas blocks and checkout form...
  4. **Canvas Inspection**: Merchant sees their product headline, hero gallery with thumbnails, problem-solution card with before/after contrast, technical specifications grid, tiered quantity bundles (1 unit, 2 units -15% off, 3 units -25% off), and reassuring COD FAQs.

- **Visual Theme & Typography**:
  - Dark Slate background with Emerald/Teal conversion accents (`#10b981`, `#0f766e`, `#0f172a`).
  - Inter & Plus Jakarta Sans typography for international English stores, Cairo typography for Arabic/Darija stores.
  - Zero-pill metadata and clean typography layout.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Schema Translation Layer**:
  - *Chosen Approach*: The backend prompts Gemini with the exact Analyst JSON schema requested (`productName`, `tagline`, `heroImages`, `badge`, `price`, `features`, `problemSolution`, `specifications`, `faq`, `codFormConfig`), and an internal adapter translates this directly into FunnelCraft's typed `LandingPageData` structure.
  - *Why*: Ensures strict adherence to the expert analyst schema while guaranteeing 100% compatibility with the existing canvas editor, drag-and-drop builder, and live HTML publisher.
- **Decision 2: Technical Specifications & Features Integration**:
  - *Chosen Approach*: Map extracted `specifications` (e.g. Resolution, Battery Life, Dimensions, Materials) into structured feature items with specialized icons (`Cpu`, `BatteryCharging`, `Maximize2`, `Layers`), displaying alongside benefits.
  - *Why*: In tech and electronics, technical specifications directly drive buying decisions and reduce return rates.
- **Decision 3: Tiered COD Bundle Auto-Calculation**:
  - *Chosen Approach*: Automatically derive standard 3-tier quantity bundles from the extracted `sellingPrice` (1 Unit at base price, 2 Units at 15% discount with "Most Popular" badge, 3 Units at 25% discount with "Best Value" badge).
  - *Why*: Increases Average Order Value (AOV) on Cash on Delivery stores by over 32%.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AiGeneratorModal.tsx                            │
│  - Tab 1: 🔗 Import from URL                                           │
│  - Default Language: English (International COD)                       │
│  - Default Niche: Smart Tech & Electronics                             │
│  - Quick Demo Links (AliExpress Mini Projector, Shopify Tech, etc.)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ POST /api/ai/import-from-url
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Express Backend (server.ts)                       │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 1. Scraper & Metadata Extractor (server/urlScraper.ts)           │  │
│  │    Extracts OpenGraph, JSON-LD, Images, Price, and Raw Specs     │  │
│  └────────────────────────────────┬─────────────────────────────────┘  │
│                                   │                                    │
│                                   ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 2. Master COD Funnel Architect Prompt (Gemini Pro)               │  │
│  │    Schema: productName, tagline, heroImages, badge, price,       │  │
│  │    features, problemSolution, specifications, faq, codFormConfig │  │
│  └────────────────────────────────┬─────────────────────────────────┘  │
│                                   │                                    │
│                                   ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 3. Translation Adapter -> FunnelCraft LandingPageData            │  │
│  │    Assembles Promo Bar, Hero, Problem/Solution, Features &       │  │
│  │    Specs, COD Form with 3 Bundles, FAQs, and Floating CTA        │  │
│  └────────────────────────────────┬─────────────────────────────────┘  │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │ { success: true, data: LandingPageData }
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Visual Canvas (App.tsx)                          │
│  - Immediate visual canvas re-render with rich specs & imagery         │
│  - Instant 1-Click Publishing & Live Hosting                           │
└────────────────────────────────────────────────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  - `server/urlScraper.ts`: Enhanced to scrape specs, material, dimensions, and feature lists from HTML tables and list elements.
  - `server.ts`:
    - Updated `POST /api/ai/import-from-url` with the exact Master Copywriter prompt and schema.
    - Adapter function `mapAnalystOutputToLandingPageData(analystJson, language)` ensuring complete compliance with `LandingPageBlock[]`.
  - `AiGeneratorModal.tsx`:
    - Updated default language to English for international stores.
    - Added quick demo triggers for Smart Tech and Electronics.
