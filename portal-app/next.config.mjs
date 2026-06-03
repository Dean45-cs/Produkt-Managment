/** @type {import('next').NextConfig} */
const nextConfig = {
  // pg ist ein natives Modul – nicht ins Server-Component-Bundle ziehen.
  experimental: {
    serverComponentsExternalPackages: ['pg'],
  },
}

export default nextConfig
