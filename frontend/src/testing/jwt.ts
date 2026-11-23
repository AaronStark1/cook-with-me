/** Builds an unsigned JWT-shaped string whose payload carries the given expiry. */
export const fakeJwt = (expiresInSeconds = 3600): string => {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return `header.${btoa(JSON.stringify({ exp }))}.signature`;
};
