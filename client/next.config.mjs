/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*', // Ensure 5000 matches your Express port
      },
    ]
  },
};

export default nextConfig;
