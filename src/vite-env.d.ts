/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_authDomain: string;
  readonly VITE_authClientID: string;
  readonly VITE_redirectURL: string;
  readonly VITE_authApiAudience: string;
  readonly VITE_axiosBaseUrl: string;
  readonly VITE_AUTH_MODE?: "dev";
  // set by the Dockerfile at build time; missing when running from source
  readonly VITE_APP_VERSION?: string;
  readonly VITE_BUILD_TIME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
