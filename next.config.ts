import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Only consented, published images live under public/ — private objects are
      // served via short-lived presigned URLs and rendered with plain <img>.
      {
        protocol: "https",
        hostname: "bellanails-media.s3.fr-par.scw.cloud",
        pathname: "/public/**",
      },
    ],
  },
};

// Points the plugin at our request config so getTranslations/useTranslations
// resolve messages per request. Path is explicit (default would be ./i18n).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
