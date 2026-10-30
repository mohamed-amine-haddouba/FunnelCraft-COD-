export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    const win = window as unknown as {
      fbq?: (...args: unknown[]) => void;
      ttq?: { track?: (...args: unknown[]) => void };
      gtag?: (...args: unknown[]) => void;
    };
    if (typeof win.gtag === 'function') {
      win.gtag('event', eventName, params || {});
    }
  } catch {
    // Ignore tracking errors
  }
}

export function trackGenerateFunnel(source: string, language: string): void {
  trackEvent('generate_funnel', { source, language });
}

export function trackSubmitCodOrder(amount: number, currency: string, productName: string): void {
  trackEvent('submit_cod_order', { value: amount, currency, item_name: productName });
  if (typeof window !== 'undefined') {
    try {
      const win = window as unknown as {
        fbq?: (...args: unknown[]) => void;
        ttq?: { track?: (...args: unknown[]) => void };
      };
      if (typeof win.fbq === 'function') {
        win.fbq('track', 'Purchase', { value: amount, currency });
      }
      if (win.ttq && typeof win.ttq.track === 'function') {
        win.ttq.track('CompletePayment', { value: amount, currency });
      }
    } catch {
      // Ignore pixel errors
    }
  }
}
