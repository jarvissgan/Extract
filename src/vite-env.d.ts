/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_authDomain: string;
  readonly VITE_authClientID: string;
  readonly VITE_redirectURL: string;
  readonly VITE_authApiAudience: string;
  readonly VITE_axiosBaseUrl: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
