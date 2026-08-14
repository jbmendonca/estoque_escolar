/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pacotes que devem rodar em Node puro (leem arquivos/binários em runtime).
  serverExternalPackages: ['@node-rs/argon2', 'pdfkit', 'exceljs'],
  // Cabeçalhos de segurança básicos (endurecimento adicional em T093).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
