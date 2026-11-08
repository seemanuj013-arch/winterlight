// Build-time constants injected by vite.config.ts (see tools/buildEnv.ts).
/** true on a production build (Vercel production, or WINTERLIGHT_STRICT=1). */
declare const __STRICT_CONTENT__: boolean;
/** SHA-256 (hex) of the preview key, or '' when no usable key is set. The key itself is never in the bundle. */
declare const __PREVIEW_KEY_HASH__: string;
