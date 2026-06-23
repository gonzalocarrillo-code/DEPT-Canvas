/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CESDK_LICENSE?: string;
  readonly VITE_IMGLY_LOCAL_ASSETS_URL?: string;
  readonly VITE_CESDK_USER_ID?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEV_TENANT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
