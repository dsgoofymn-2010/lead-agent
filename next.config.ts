import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @libsql/client loads native code for local files, so Next.js should not bundle it.
  serverExternalPackages: ["@libsql/client", "libsql", "@libsql/hrana-client", "@libsql/isomorphic-ws", "@libsql/isomorphic-fetch"],
  // This folder is the project root (there is another lockfile in the home folder).
  turbopack: { root: __dirname },
};

export default nextConfig;
