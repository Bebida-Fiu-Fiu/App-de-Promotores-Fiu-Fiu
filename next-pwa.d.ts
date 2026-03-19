declare module "next-pwa" {
  import type { NextConfig } from "next";

  type PWAOptions = {
    dest: string;
    disable?: boolean;
    register?: boolean;
    skipWaiting?: boolean;
  };

  export default function withPWAInit(
    options: PWAOptions
  ): (config: NextConfig) => NextConfig;
}
