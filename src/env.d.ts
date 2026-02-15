/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_GOOGLE_API_KEY: string;
  readonly PUBLIC_GOOGLE_CLIENT_ID: string;
  readonly PUBLIC_GOOGLE_SHEET_ID: string;
  readonly PUBLIC_GOOGLE_DRIVE_TJENESTER_FOLDER_ID: string;
  readonly PUBLIC_GOOGLE_DRIVE_MELDINGER_FOLDER_ID: string;
  readonly PUBLIC_GOOGLE_DRIVE_TANNLEGER_FOLDER_ID: string;
  readonly GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  readonly GOOGLE_PRIVATE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
