import dayjs from "dayjs";

// The commit and build time this page was built from, set by the Dockerfile (from the deploy
// workflow or deploy.sh). Missing when running from source.
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || "dev";
export const APP_BUILT_AT = import.meta.env.VITE_BUILD_TIME || null;

// a full commit hash is shortened to the 7 characters GitHub shows
export const shortVersion = (v: string) => (/^[0-9a-f]{40}$/.test(v) ? v.slice(0, 7) : v);
export const formatBuiltAt = (iso: string | null) => (iso ? dayjs(iso).format("D MMM YYYY, h:mm A") : null);
