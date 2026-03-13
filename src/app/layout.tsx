import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HOBBYTAN AI 콜센터',
  description: 'ElevenLabs Conversational AI 기반 AI 콜센터 자동화 시스템',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-dark text-white min-h-screen">{children}</body>
    </html>
  );
}
