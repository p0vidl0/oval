import type { NextConfig } from "next";

const tunnelDevOrigins = [
  "*.ngrok-free.dev",
  "*.ngrok-free.app",
  "*.ngrok.io",
  ...(process.env.NEXT_DEV_TUNNEL_HOST
    ? [
        process.env.NEXT_DEV_TUNNEL_HOST.replace(/^https?:\/\//, "").split(
          "/",
        )[0] ?? "",
      ]
    : []),
].filter(Boolean);

const nextConfig: NextConfig = {
  // Project rules live in AGENTS.md + .agents/rules/ (not Next.js generated block)
  agentRules: false,
  serverExternalPackages: ["nodemailer"],
  // Dev-only: browser opened via ngrok tunnel (Telegram OIDC testing)
  allowedDevOrigins: tunnelDevOrigins,
};

export default nextConfig;
