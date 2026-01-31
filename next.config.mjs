/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SCHEDULE_START_DATE: process.env.SCHEDULE_START_DATE,
  },
};

export default nextConfig;
