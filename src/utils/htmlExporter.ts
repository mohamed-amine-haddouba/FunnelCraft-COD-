import { LandingPageData, LandingPageBlock } from '../types/landingPage';

/**
 * Compiles a LandingPageData state into an ultra-fast, self-contained standalone HTML file
 * with Tailwind CDN, Google Fonts, interactive COD bundle logic, countdown timer, and order confirmation.
 */
export function generateStandaloneHtml(data: LandingPageData): string {
  const isRtl = data.direction === 'rtl' || data.language === 'ar';
  const primaryColor = data.theme?.primaryColor || '#10b981';
  const fontFamily = isRtl ? 'Cairo, sans-serif' : 'Inter, sans-serif';
  const lang = data.language || (isRtl ? 'ar' : 'en');

  // Render individual block HTML
  const blocks = Array.isArray(data.blocks) ? data.blocks : [];
  const blocksHtml = blocks
    .map((block) => renderBlockToHtml(block, data))
    .join('\n');

  const fbPixelId = (data.pixels?.facebookPixelId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const ttPixelId = (data.pixels?.tiktokPixelId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const gaId = (data.pixels?.googleAnalyticsId || '').replace(/[^a-zA-Z0-9_-]/g, '');

  const fbPixelScript = fbPixelId
    ? `<!-- Meta Pixel Code -->
  <script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${fbPixelId}');
  fbq('track', 'PageView');
  </script>`
    : '';

  const ttPixelScript = ttPixelId
    ? `<!-- TikTok Pixel Code -->
  <script>
  !function (w, d, t) {
    w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
    ttq.load('${ttPixelId}');
    ttq.page();
  }(window, document, 'ttq');
  </script>`
    : '';

  const gaScript = gaId
    ? `<!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${gaId}');
  </script>`
    : '';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${isRtl ? 'rtl' : 'ltr'}" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.title)}</title>
  <meta name="description" content="${escapeHtml(data.title)} - Cash on Delivery Fast Checkout">
  ${fbPixelScript}
  ${ttPixelScript}
  ${gaScript}
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: '${primaryColor}',
          },
          fontFamily: {
            sans: ['${fontFamily}'],
          }
        }
      }
    }
  </script>
  <style>
    body {
      font-family: ${fontFamily};
      -webkit-font-smoothing: antialiased;
    }
    @keyframes pulse-fast {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }
    .pulse-btn {
      animation: pulse-fast 2.5s infinite ease-in-out;
    }
  </style>
</head>
<body class="bg-gray-50 text-gray-900 selection:bg-emerald-500 selection:text-white pb-20 md:pb-0">

  ${blocksHtml}

  <!-- Order Success Modal -->
  <div id="order-success-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm hidden opacity-0 transition-opacity duration-300">
    <div class="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 text-center shadow-2xl transform scale-95 transition-transform duration-300" id="order-modal-card">
      <div class="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 text-4xl shadow-inner">
        ✓
      </div>
      <span class="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full mb-3 uppercase tracking-wider">
        ${isRtl ? 'تم تسجيل طلبك بنجاح' : 'Order Confirmed • Cash on Delivery'}
      </span>
      <h3 class="text-2xl font-black text-gray-900 mb-2">
        ${isRtl ? 'شكراً لثقتكم بنا!' : 'Thank you for your order!'}
      </h3>
      <p class="text-gray-600 text-sm mb-6 leading-relaxed">
        ${isRtl 
          ? 'سيتصل بك مندوب خدمة العملاء في غضون دقائق هاتفياً لتأكيد العنوان وشحن الطرد فوراً.' 
          : 'Our logistics agent will contact you shortly via phone to confirm your address and dispatch your package.'}
      </p>

      <div class="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-left text-xs space-y-2 mb-6" dir="${isRtl ? 'rtl' : 'ltr'}">
        <div class="flex justify-between font-medium">
          <span class="text-gray-500">${isRtl ? 'رقم الطلب:' : 'Order ID:'}</span>
          <span class="font-bold text-gray-900" id="modal-order-id">#COD-89214</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">${isRtl ? 'الاسم:' : 'Recipient:'}</span>
          <span class="font-semibold text-gray-900" id="modal-customer-name">-</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">${isRtl ? 'الباقة المحددة:' : 'Selected Bundle:'}</span>
          <span class="font-semibold text-gray-900" id="modal-bundle-name">-</span>
        </div>
        <div class="flex justify-between border-t border-gray-200 pt-2 font-bold text-sm">
          <span>${isRtl ? 'المبلغ المطلوب نقداً:' : 'Total (Pay on Delivery):'}</span>
          <span class="text-emerald-600" id="modal-total-price">-</span>
        </div>
      </div>

      <button onclick="closeSuccessModal()" class="w-full py-3.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl transition shadow-lg">
        ${isRtl ? 'حسناً، فهمت' : 'Great, Done'}
      </button>
    </div>
  </div>

  <!-- Interactive Scripts -->
  <script>
    window.__FUNNELCRAFT_SLUG__ = "${escapeHtml(data.slug || '')}";

    // Countdown Timer logic
    function initCountdowns() {
      const timerElements = document.querySelectorAll('[data-timer]');
      timerElements.forEach(el => {
        let minutes = parseInt(el.getAttribute('data-minutes') || '15', 10);
        let seconds = 0;
        
        function updateDisplay() {
          const m = String(minutes).padStart(2, '0');
          const s = String(seconds).padStart(2, '0');
          el.textContent = m + ':' + s;
        }
        
        updateDisplay();
        
        const interval = setInterval(() => {
          if (seconds === 0) {
            if (minutes === 0) {
              minutes = 14;
              seconds = 59;
            } else {
              minutes--;
              seconds = 59;
            }
          } else {
            seconds--;
          }
          updateDisplay();
        }, 1000);
      });
    }

    // FAQ Accordion logic
    function toggleFaq(btn) {
      const answer = btn.nextElementSibling;
      const icon = btn.querySelector('.faq-icon');
      const isExpanded = !answer.classList.contains('hidden');
      
      if (isExpanded) {
        answer.classList.add('hidden');
        if (icon) icon.style.transform = 'rotate(0deg)';
      } else {
        answer.classList.remove('hidden');
        if (icon) icon.style.transform = 'rotate(180deg)';
      }
    }

    // COD Checkout Form Logic
    let selectedBundlePrice = 0;
    let selectedBundleName = '';

    function selectBundle(element, price, name) {
      document.querySelectorAll('.bundle-card').forEach(card => {
        card.classList.remove('border-emerald-500', 'bg-emerald-50/50', 'ring-2', 'ring-emerald-500');
        card.classList.add('border-gray-200');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = false;
      });

      element.classList.remove('border-gray-200');
      element.classList.add('border-emerald-500', 'bg-emerald-50/50', 'ring-2', 'ring-emerald-500');
      const radio = element.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;

      selectedBundlePrice = price;
      selectedBundleName = name;

      const summaryPriceEl = document.getElementById('checkout-total-price');
      if (summaryPriceEl) {
        summaryPriceEl.textContent = price;
      }
    }

    async function handleCodSubmit(event) {
      event.preventDefault();
      const form = event.target;
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.innerHTML : '';

      const name = form.customerName ? form.customerName.value.trim() : 'Customer';
      const phone = form.customerPhone ? form.customerPhone.value.trim() : '';
      const city = form.customerCity ? form.customerCity.value.trim() : '';
      const address = form.customerAddress ? form.customerAddress.value.trim() : '';
      const notes = form.customerNotes ? form.customerNotes.value.trim() : '';

      if (!phone) {
        alert('${isRtl ? 'يرجى إدخال رقم هاتفك للتواصل' : 'Please provide your phone number to receive confirmation.'}');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>${isRtl ? 'جاري تأكيد الطلب...' : 'Confirming Order...'}</span>';
      }

      let generatedId = '#COD-' + Math.floor(10000 + Math.random() * 90000);

      try {
        const payload = {
          pageSlug: window.__FUNNELCRAFT_SLUG__ || '',
          pageTitle: document.title || '',
          customerName: name,
          customerPhone: phone,
          customerCity: city,
          customerAddress: address,
          customerNotes: notes,
          bundleName: selectedBundleName || 'Default Offer',
          bundlePrice: selectedBundlePrice || 0,
        };

        const res = await fetch('/api/orders/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const resData = await res.json();
          if (resData.orderId) {
            generatedId = resData.orderId;
          }
        }
      } catch (err) {
        console.warn('Network submit fallback:', err);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
      }

      document.getElementById('modal-order-id').textContent = generatedId;
      document.getElementById('modal-customer-name').textContent = name + (city ? ' (' + city + ')' : '');
      document.getElementById('modal-bundle-name').textContent = selectedBundleName || 'Selected Offer';
      document.getElementById('modal-total-price').textContent = selectedBundlePrice ? selectedBundlePrice : 'Confirmed';

      const modal = document.getElementById('order-success-modal');
      const card = document.getElementById('order-modal-card');
      modal.classList.remove('hidden');
      setTimeout(() => {
        modal.classList.remove('opacity-0');
        card.classList.remove('scale-95');
        card.classList.add('scale-100');
      }, 10);

      form.reset();
    }

    function closeSuccessModal() {
      const modal = document.getElementById('order-success-modal');
      const card = document.getElementById('order-modal-card');
      modal.classList.add('opacity-0');
      card.classList.remove('scale-100');
      card.classList.add('scale-95');
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 300);
    }

    function scrollToCheckout() {
      const checkout = document.getElementById('cod-checkout-section');
      if (checkout) {
        checkout.scrollIntoView({ behavior: 'smooth' });
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      initCountdowns();
      // Select first bundle by default if available
      const firstBundle = document.querySelector('.bundle-card');
      if (firstBundle) {
        firstBundle.click();
      }
    });
  </script>
</body>
</html>`;
}

function renderBlockToHtml(block: LandingPageBlock, page: LandingPageData): string {
  switch (block.type) {
    case 'promo-bar':
      return `
      <div class="${block.isSticky ? 'sticky top-0 z-40' : ''} text-center py-2.5 px-4 text-xs md:text-sm font-semibold shadow-md flex items-center justify-center flex-wrap gap-2 transition"
           style="background-color: ${block.bgColor}; color: ${block.textColor};">
        <span>${escapeHtml(block.text)}</span>
        ${
          block.showTimer
            ? `<div class="inline-flex items-center gap-1.5 bg-white/20 px-2.5 py-0.5 rounded-full font-mono text-xs font-bold tracking-widest">
                <span>⏱</span>
                <span data-timer data-minutes="${block.countdownMinutes}">14:59</span>
              </div>`
            : ''
        }
        ${
          block.stockWarning
            ? `<span class="bg-red-500/80 text-white px-2 py-0.5 rounded-full text-[11px] font-bold animate-pulse">${escapeHtml(
                block.stockWarning
              )}</span>`
            : ''
        }
      </div>`;

    case 'hero': {
      const discountPercentage =
        block.priceOriginal && block.priceDiscounted
          ? Math.round(((block.priceOriginal - block.priceDiscounted) / block.priceOriginal) * 100)
          : 50;

      return `
      <section class="max-w-6xl mx-auto px-4 py-8 md:py-16">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <!-- Gallery -->
          <div class="lg:col-span-6 space-y-4">
            <div class="relative rounded-3xl overflow-hidden bg-gray-100 shadow-xl border border-gray-200 aspect-square">
              <img id="main-hero-img" src="${block.images[0] || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1000&q=80'}" 
                   alt="${escapeHtml(block.headline)}" 
                   class="w-full h-full object-cover">
              <span class="absolute top-4 left-4 bg-red-600 text-white font-extrabold text-xs px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg">
                -${discountPercentage}% OFF
              </span>
            </div>
            ${
              block.images.length > 1
                ? `<div class="flex gap-3 overflow-x-auto pb-2">
                    ${block.images
                      .map(
                        (img, idx) => `
                        <img src="${img}" 
                             onclick="document.getElementById('main-hero-img').src='${img}'"
                             alt="Thumbnail ${idx + 1}" 
                             class="w-20 h-20 rounded-xl object-cover cursor-pointer border-2 border-transparent hover:border-emerald-500 transition shadow">`
                      )
                      .join('')}
                  </div>`
                : ''
            }
          </div>

          <!-- Content & CTA -->
          <div class="lg:col-span-6 space-y-6">
            ${
              block.badge
                ? `<div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold tracking-wide">
                    ${escapeHtml(block.badge)}
                  </div>`
                : ''
            }
            
            <h1 class="text-3xl md:text-5xl font-black text-gray-900 leading-tight">
              ${escapeHtml(block.headline)}
            </h1>

            <p class="text-base md:text-lg text-gray-600 leading-relaxed">
              ${escapeHtml(block.subheadline)}
            </p>

            <!-- Price & Trust -->
            <div class="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-4">
              <div class="flex items-baseline gap-3">
                <span class="text-3xl md:text-4xl font-black text-emerald-600">
                  ${block.priceDiscounted} ${escapeHtml(block.currency)}
                </span>
                <span class="text-lg md:text-xl text-gray-400 line-through">
                  ${block.priceOriginal} ${escapeHtml(block.currency)}
                </span>
                <span class="ml-auto bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-md">
                  Save ${discountPercentage}%
                </span>
              </div>

              <!-- Rating -->
              <div class="flex items-center gap-2 text-sm text-gray-600 border-t border-gray-100 pt-3">
                <div class="flex text-amber-400 text-base">★★★★★</div>
                <span class="font-bold text-gray-900">${block.rating || 4.9}/5</span>
                <span class="text-gray-400">(${block.reviewCount || 2800}+ reviews)</span>
              </div>
            </div>

            <!-- CTA Button -->
            <div class="space-y-3">
              <button onclick="scrollToCheckout()" 
                      class="w-full py-4 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-lg md:text-xl rounded-2xl shadow-xl hover:shadow-2xl transition transform active:scale-95 pulse-btn text-center flex items-center justify-center gap-3">
                <span>${escapeHtml(block.ctaText)}</span>
                <span class="text-2xl">➔</span>
              </button>
              <p class="text-center text-xs text-gray-500 font-medium">
                ${escapeHtml(block.ctaSubtext)}
              </p>
            </div>

            <!-- Bullet trust points -->
            <ul class="space-y-2 pt-2 border-t border-gray-100">
              ${block.trustPoints
                .map(
                  (pt) => `
                <li class="flex items-center gap-2.5 text-sm font-medium text-gray-700">
                  <span class="text-emerald-500 font-bold">✔</span>
                  <span>${escapeHtml(pt)}</span>
                </li>`
                )
                .join('')}
            </ul>
          </div>
        </div>
      </section>`;
    }

    case 'problem-solution':
      return `
      <section class="max-w-5xl mx-auto px-4 py-12 md:py-20">
        <div class="text-center max-w-2xl mx-auto mb-12">
          ${
            block.highlightBadge
              ? `<span class="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-extrabold rounded-full mb-3 uppercase tracking-wider">
                  ${escapeHtml(block.highlightBadge)}
                </span>`
              : ''
          }
          <h2 class="text-3xl md:text-4xl font-black text-gray-900 mb-3">${escapeHtml(block.title)}</h2>
          <p class="text-gray-600 text-sm md:text-base">${escapeHtml(block.subtitle)}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <!-- Problem Box -->
          <div class="bg-red-50/70 border border-red-200 rounded-3xl p-6 md:p-8 space-y-4">
            <div class="flex items-center gap-3 border-b border-red-200 pb-4">
              <div class="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xl">✕</div>
              <h3 class="text-xl font-bold text-red-900">${escapeHtml(block.problemTitle)}</h3>
            </div>
            <ul class="space-y-3 pt-2">
              ${block.problemItems
                .map(
                  (item) => `
                <li class="flex items-start gap-3 text-sm text-red-800">
                  <span class="text-red-500 font-bold mt-0.5">✕</span>
                  <span>${escapeHtml(item)}</span>
                </li>`
                )
                .join('')}
            </ul>
          </div>

          <!-- Solution Box -->
          <div class="bg-emerald-50/70 border-2 border-emerald-400 rounded-3xl p-6 md:p-8 space-y-4 shadow-lg relative">
            <div class="absolute -top-3.5 right-6 bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow">
              Recommended Choice
            </div>
            <div class="flex items-center gap-3 border-b border-emerald-200 pb-4">
              <div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xl">✓</div>
              <h3 class="text-xl font-bold text-emerald-900">${escapeHtml(block.solutionTitle)}</h3>
            </div>
            <ul class="space-y-3 pt-2">
              ${block.solutionItems
                .map(
                  (item) => `
                <li class="flex items-start gap-3 text-sm text-emerald-900 font-medium">
                  <span class="text-emerald-600 font-bold mt-0.5">✔</span>
                  <span>${escapeHtml(item)}</span>
                </li>`
                )
                .join('')}
            </ul>
          </div>
        </div>
      </section>`;

    case 'features':
      return `
      <section class="max-w-6xl mx-auto px-4 py-12 md:py-20 bg-white border-y border-gray-100">
        <div class="text-center max-w-2xl mx-auto mb-12">
          <h2 class="text-3xl md:text-4xl font-black text-gray-900 mb-3">${escapeHtml(block.title)}</h2>
          <p class="text-gray-600 text-sm md:text-base">${escapeHtml(block.subtitle)}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          ${block.items
            .map(
              (item) => `
            <div class="p-6 rounded-2xl bg-gray-50 border border-gray-200 hover:border-emerald-500 hover:shadow-md transition group">
              <div class="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-2xl mb-4 group-hover:scale-110 transition">
                ⚡
              </div>
              ${
                item.badge
                  ? `<span class="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded mb-2 uppercase">
                      ${escapeHtml(item.badge)}
                    </span>`
                  : ''
              }
              <h3 class="font-bold text-lg text-gray-900 mb-2">${escapeHtml(item.title)}</h3>
              <p class="text-gray-600 text-sm leading-relaxed">${escapeHtml(item.description)}</p>
            </div>`
            )
            .join('')}
        </div>
      </section>`;

    case 'social-proof':
      return `
      <section class="max-w-6xl mx-auto px-4 py-12 md:py-20">
        <div class="text-center max-w-2xl mx-auto mb-12">
          <div class="flex items-center justify-center gap-2 mb-2 text-amber-400 text-xl">
            ★★★★★
          </div>
          <h2 class="text-3xl md:text-4xl font-black text-gray-900 mb-2">${escapeHtml(block.title)}</h2>
          <p class="text-gray-600 text-sm">${escapeHtml(block.subtitle)} (${block.totalReviews}+ reviews)</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          ${block.reviews
            .map(
              (rev) => `
            <div class="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex text-amber-400 text-sm">★★★★★</div>
                <span class="text-xs text-gray-400">${escapeHtml(rev.date)}</span>
              </div>
              <p class="text-gray-700 text-sm leading-relaxed italic">
                "${escapeHtml(rev.comment)}"
              </p>
              <div class="flex items-center gap-3 pt-3 border-t border-gray-100">
                ${
                  rev.avatar
                    ? `<img src="${rev.avatar}" alt="${escapeHtml(rev.name)}" class="w-10 h-10 rounded-full object-cover border border-emerald-500">`
                    : `<div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm">${escapeHtml(
                        rev.name.charAt(0)
                      )}</div>`
                }
                <div>
                  <h4 class="font-bold text-sm text-gray-900">${escapeHtml(rev.name)}</h4>
                  <p class="text-[11px] text-gray-500">${escapeHtml(rev.city)} • <span class="text-emerald-600 font-bold">✔ Verified Buyer</span></p>
                </div>
              </div>
            </div>`
            )
            .join('')}
        </div>
      </section>`;

    case 'cod-form':
      return `
      <section id="cod-checkout-section" class="max-w-3xl mx-auto px-4 py-12 md:py-20">
        <div class="bg-white rounded-3xl border-2 border-emerald-500 p-6 md:p-10 shadow-2xl relative">
          <div class="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest px-6 py-1.5 rounded-full shadow-lg">
            💵 CASH ON DELIVERY • PAY AT DOORSTEP
          </div>

          <div class="text-center mt-2 mb-8">
            <h2 class="text-2xl md:text-3xl font-black text-gray-900 mb-2">${escapeHtml(block.title)}</h2>
            <p class="text-gray-600 text-sm">${escapeHtml(block.subtitle)}</p>
          </div>

          <form onsubmit="handleCodSubmit(event)" class="space-y-6">
            <!-- Step 1: Bundle Selection -->
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-3">
                1. Select Your Bundle / Quantity:
              </label>
              <div class="space-y-3">
                ${block.bundles
                  .map(
                    (bundle, idx) => `
                  <div onclick="selectBundle(this, '${bundle.price} ${escapeHtml(block.currency)}', '${escapeHtml(bundle.name)}')" 
                       class="bundle-card border rounded-2xl p-4 cursor-pointer transition flex items-center justify-between gap-4 ${
                         bundle.popular
                           ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500'
                           : 'border-gray-200 hover:border-emerald-300'
                       }">
                    <div class="flex items-center gap-3">
                      <input type="radio" name="bundleOption" class="w-5 h-5 text-emerald-600" ${bundle.popular || idx === 0 ? 'checked' : ''}>
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-gray-900 text-sm md:text-base">${escapeHtml(bundle.name)}</span>
                          ${
                            bundle.badge
                              ? `<span class="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">${escapeHtml(
                                  bundle.badge
                                )}</span>`
                              : ''
                          }
                        </div>
                        <span class="text-xs text-gray-500">Free Express Delivery Included</span>
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="text-lg md:text-xl font-black text-emerald-600">
                        ${bundle.price} ${escapeHtml(block.currency)}
                      </div>
                      <div class="text-xs text-gray-400 line-through">
                        ${bundle.originalPrice} ${escapeHtml(block.currency)}
                      </div>
                    </div>
                  </div>`
                  )
                  .join('')}
              </div>
            </div>

            <!-- Step 2: Customer Delivery Details -->
            <div class="space-y-4 pt-4 border-t border-gray-100">
              <label class="block text-xs font-bold uppercase tracking-wider text-gray-700">
                2. Shipping & Delivery Details (No Card Required):
              </label>

              <div>
                <input type="text" name="customerName" required placeholder="Full Name (e.g. John Doe)" 
                       class="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition">
              </div>

              <div>
                <input type="tel" name="customerPhone" required placeholder="Phone Number (e.g. +1 555 123 4567)" 
                       class="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition font-mono">
                <p class="text-[11px] text-gray-500 mt-1">Our agent will call this number to verify the order before shipping.</p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <input type="text" name="customerCity" required placeholder="City / Province" 
                         class="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition">
                </div>
                <div>
                  <input type="text" name="customerAddress" required placeholder="Full Street Address / Home No." 
                         class="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition">
                </div>
              </div>

              <div>
                <textarea name="customerNotes" rows="2" placeholder="Optional delivery instructions (e.g. deliver after 4 PM, ring bell)" 
                          class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition"></textarea>
              </div>
            </div>

            <!-- Guarantee Notice -->
            <div class="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
              <span class="text-lg">🛡️</span>
              <span>${escapeHtml(block.guaranteeText)}</span>
            </div>

            <!-- Submit Button -->
            <button type="submit" 
                    class="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-lg rounded-2xl shadow-xl transition flex items-center justify-center gap-2 pulse-btn">
              <span>${escapeHtml(block.buttonText)}</span>
              <span class="text-xl">➔</span>
            </button>
          </form>
        </div>
      </section>`;

    case 'faq':
      return `
      <section class="max-w-3xl mx-auto px-4 py-12 md:py-20">
        <div class="text-center mb-10">
          <h2 class="text-3xl font-black text-gray-900 mb-2">${escapeHtml(block.title)}</h2>
          <p class="text-gray-600 text-sm">${escapeHtml(block.subtitle)}</p>
        </div>

        <div class="space-y-4">
          ${block.items
            .map(
              (item) => `
            <div class="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <button type="button" onclick="toggleFaq(this)" 
                      class="w-full p-5 text-left font-bold text-gray-900 flex justify-between items-center hover:bg-gray-50 transition">
                <span>${escapeHtml(item.question)}</span>
                <span class="faq-icon text-gray-400 text-lg transition-transform duration-200">▼</span>
              </button>
              <div class="px-5 pb-5 pt-1 text-sm text-gray-600 leading-relaxed border-t border-gray-50 hidden">
                ${escapeHtml(item.answer)}
              </div>
            </div>`
            )
            .join('')}
        </div>
      </section>`;

    case 'floating-cta':
      return `
      <div class="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 p-3 shadow-2xl md:hidden">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <h4 class="text-xs font-bold text-gray-900 truncate">${escapeHtml(block.title)}</h4>
            <div class="text-xs font-black text-emerald-600">${escapeHtml(block.priceText)}</div>
          </div>
          <button onclick="scrollToCheckout()" 
                  class="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg transition">
            ${escapeHtml(block.buttonText)}
          </button>
        </div>
      </div>`;

    case 'trust-badges':
      return `
      <section class="max-w-5xl mx-auto px-4 py-10">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          ${block.badges
            .map(
              (b) => `
            <div class="text-center p-4 rounded-2xl bg-white border border-gray-200 shadow-sm">
              <div class="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 mx-auto mb-2 flex items-center justify-center font-bold text-lg">
                ★
              </div>
              <h4 class="font-bold text-xs text-gray-900 mb-1">${escapeHtml(b.title)}</h4>
              <p class="text-[11px] text-gray-500">${escapeHtml(b.description)}</p>
            </div>`
            )
            .join('')}
        </div>
      </section>`;

    default:
      return '';
  }
}

function escapeHtml(str: string | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
