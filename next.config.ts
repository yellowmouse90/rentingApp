import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  watchOptions: {
    pollIntervalMs: 500,
  },
  async headers() {
    return [
      {
        // Extensionless, so Next's static file serving would otherwise fall back to
        // application/octet-stream - iOS fetches this directly (not through the app) to verify
        // the Universal Links association in `ios/Runner/Runner.entitlements` (Flutter app repo)
        // and expects JSON.
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
      {
        // Verifies the Android App Links `autoVerify` intent-filter in the Flutter app's
        // AndroidManifest.xml against this app's signing certificate.
        source: "/.well-known/assetlinks.json",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ]
  },
}

export default nextConfig

