/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  images: {
    // Vercel 이미지 변환 한도를 아끼려고 최적화를 끈다 (예시 페이지 — 원본은 미리 압축해 둠)
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
}

module.exports = nextConfig
