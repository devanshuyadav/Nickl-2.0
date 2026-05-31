/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Route 1: PDF Uploads
      {
        source: '/api/upload/:path*',
        destination: 'https://nickl-2-0.onrender.com/api/upload/:path*',
      },
      // Route 2: Dashboard & Database
      {
        source: '/api/portfolio/:path*',
        destination: 'https://nickl-2-0.onrender.com/api/portfolio/:path*',
      },
      // Route 3: Live Market Data
      {
        source: '/api/market/:path*',
        destination: 'https://nickl-2-0.onrender.com/api/market/:path*',
      },
      // Route 4: Corporate Actions (Splits)
      {
        source: '/api/corporate/:path*',
        destination: 'https://nickl-2-0.onrender.com/api/corporate/:path*',
      }
      // we DO NOT include /api/auth here! Next.js will now handle authentication locally.
    ]
  },
};

export default nextConfig;
