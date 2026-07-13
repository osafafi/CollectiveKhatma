import createCache, { type EmotionCache } from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';

/**
 * Emotion cache that flips MUI's generated CSS to RTL (RM-210, AD-08).
 *
 * MUI styles through Emotion, so RTL cannot be achieved with `dir="rtl"` alone —
 * the CSS-in-JS itself must be mirrored (`padding-left` → `padding-right`, etc.),
 * including for portalled components (Menu, Select, Dialog, Tooltip) that render
 * into `document.body`. Supplying `stylisPlugins` REPLACES Emotion's defaults, so
 * `prefixer` (vendor prefixing) is included explicitly before `rtlPlugin`.
 *
 * The `mui-rtl` key namespaces the generated class names and the injected
 * `<style data-emotion>` tag.
 */
export function createRtlCache(): EmotionCache {
  return createCache({
    key: 'mui-rtl',
    stylisPlugins: [prefixer, rtlPlugin],
  });
}
