import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  reactStrictMode: true,
  transpilePackages: ["saltshaker"],
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding"],
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.module.rules.push({
      test: /\.wgsl$/i,
      type: "asset/source",
    });
    config.resolve.fallback = {
      fs: false,
      buffer: false,
      net: false,
      tls: false,
      "@react-native-async-storage/async-storage": false,
    };

    return config;
  },
};

export default nextConfig;
