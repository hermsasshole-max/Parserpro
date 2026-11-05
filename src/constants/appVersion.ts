export interface AppVersionInfo {
  versionName: string;
  buildNumber: number;
  agpVersion: string;
  displayLabel: string;
}

declare global {
  interface Window {
    __PARSERPRO_NATIVE_VERSION__?: {
      versionName?: string;
      versionCode?: number;
    };
  }
}

const metaEnv =
  typeof import.meta !== 'undefined'
    ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    : undefined;

export const APP_VERSION: string =
  (metaEnv && typeof metaEnv.VITE_APP_VERSION === 'string' && metaEnv.VITE_APP_VERSION.trim()) ||
  '1.8.0';

export const APP_BUILD_NUMBER: number =
  (metaEnv && Number(metaEnv.VITE_APP_BUILD_NUMBER) >= 260
    ? Number(metaEnv.VITE_APP_BUILD_NUMBER)
    : 0) || 260;

export const APP_AGP_VERSION = '9.0.1';

export function getDisplayVersionInfo(): AppVersionInfo {
  if (typeof window !== 'undefined' && window.__PARSERPRO_NATIVE_VERSION__) {
    const nativeVn = window.__PARSERPRO_NATIVE_VERSION__.versionName?.trim();
    const nativeVc = Number(window.__PARSERPRO_NATIVE_VERSION__.versionCode);
    const resolvedVn = nativeVn || APP_VERSION;
    const resolvedVc = Number.isFinite(nativeVc) && nativeVc > 0 ? nativeVc : APP_BUILD_NUMBER;
    return {
      versionName: resolvedVn,
      buildNumber: resolvedVc,
      agpVersion: APP_AGP_VERSION,
      displayLabel: `v${resolvedVn} · Build ${resolvedVc}`,
    };
  }

  return {
    versionName: APP_VERSION,
    buildNumber: APP_BUILD_NUMBER,
    agpVersion: APP_AGP_VERSION,
    displayLabel: `v${APP_VERSION} · Build ${APP_BUILD_NUMBER}`,
  };
}
