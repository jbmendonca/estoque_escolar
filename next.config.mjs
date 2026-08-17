/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pacotes que devem rodar em Node puro (leem arquivos/binários em runtime).
  serverExternalPackages: ['@node-rs/argon2', 'pdfkit', 'exceljs'],
  // Cabeçalhos de segurança. A aplicação não carrega script/estilo/fonte de
  // origem externa, então a CSP restringe tudo a 'self'. 'unsafe-inline' cobre
  // os scripts de hidratação e estilos do Next; as diretivas rígidas
  // (frame-ancestors, object-src, base-uri, form-action) barram clickjacking,
  // injeção de <base> e sequestro de formulário.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: csp },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
