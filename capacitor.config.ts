import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.toolshare.app",
  appName: "Pietro",
  webDir: "www",
  server: {
    url: "https://renting-app-azure.vercel.app",
    androidScheme: "https",
  },
}

export default config
