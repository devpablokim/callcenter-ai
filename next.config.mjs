/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: '/callcenter-ai',
  images: { unoptimized: true },
};

export default nextConfig;
