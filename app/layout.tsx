import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'DropWatch - Hitta utgående domäner',
  description: 'Bevaka domäner i Pending Delete-stadiet',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <head><meta name='impact-site-verification' value='ca0aaced-7984-4e30-a189-511ccce10bb0'></head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
