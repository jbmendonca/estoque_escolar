import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Controle de Estoque Escolar',
  description: 'Sistema de controle de estoque de merenda e materiais escolares',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
