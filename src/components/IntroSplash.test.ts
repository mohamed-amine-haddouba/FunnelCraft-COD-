import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowIntroSplash } from './IntroSplash';

test('shouldShowIntroSplash returns true on first visit to public routes', () => {
  assert.equal(
    shouldShowIntroSplash({
      introShownInSession: false,
      prefersReducedMotion: false,
      pathname: '/',
    }),
    true
  );
  assert.equal(
    shouldShowIntroSplash({
      introShownInSession: false,
      prefersReducedMotion: false,
      pathname: '/ar',
    }),
    true
  );
});

test('shouldShowIntroSplash returns false when already shown in session or reduced motion is preferred', () => {
  assert.equal(
    shouldShowIntroSplash({
      introShownInSession: true,
      prefersReducedMotion: false,
      pathname: '/',
    }),
    false
  );
  assert.equal(
    shouldShowIntroSplash({
      introShownInSession: false,
      prefersReducedMotion: true,
      pathname: '/',
    }),
    false
  );
});

test('shouldShowIntroSplash returns false on dashboard, sandbox, and admin routes', () => {
  for (const path of ['/dashboard', '/dashboard/builder', '/sandbox', '/admin', '/ar/admin']) {
    assert.equal(
      shouldShowIntroSplash({
        introShownInSession: false,
        prefersReducedMotion: false,
        pathname: path,
      }),
      false,
      `Expected false for path ${path}`
    );
  }
});
