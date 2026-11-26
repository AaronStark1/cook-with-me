// Replaced at build time by `ng build --define "API_URL='https://…'"` (render.yaml
// does this). The URL has no trailing slash and no /api.
declare const API_URL: string | undefined;

export const environment = {
  production: true,
  // Empty = same origin: the API is expected at /api/... behind the same host
  // (e.g. a reverse proxy). Without --define, that is what a build uses.
  apiUrl: typeof API_URL === 'string' ? API_URL : '',
};
