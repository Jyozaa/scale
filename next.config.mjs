/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Generated games are read from disk at request time (never statically
    // imported), so make sure serverless/standalone traces include them.
    outputFileTracingIncludes: {
      "/play": ["./data/games/**/*"],
      "/game/[id]": ["./data/games/**/*"],
    },
  },
};
export default nextConfig;
