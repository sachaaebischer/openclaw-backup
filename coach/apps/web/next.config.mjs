/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @coach/lib ships compiled JS in dist; transpile it through Next's pipeline.
  transpilePackages: ["@coach/lib"],
};

export default nextConfig;
