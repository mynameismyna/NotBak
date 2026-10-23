/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "imapflow",
    "mailparser",
    "ldapjs",
    "ldapauth-fork",
  ],
};

export default nextConfig;
