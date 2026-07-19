/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fyvuyzggqkkeawfmiapz.supabase.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // the project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
