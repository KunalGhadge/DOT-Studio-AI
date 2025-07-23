/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(ogg|mp3|wav|mpe?g)$/i,
      use: [
        {
          loader: "url-loader",
          options: {
            limit: 8192,
            publicPath: "/_next/static/sounds/",
            outputPath: "static/sounds/",
            name: "[name].[ext]",
          },
        },
      ],
    });
    return config;
  },
};

export default nextConfig;
