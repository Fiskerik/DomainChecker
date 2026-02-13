import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://domain-checker-henna.vercel.app')),
  title: 'DropWatch - Hitta utgående domäner',
  description: 'Bevaka domäner i Pending Delete-stadiet',
  // Lägg till verifiering här
  verification: {
    other: {
      'impact-site-verification': 'ca0aaced-7984-4e30-a189-511ccce10bb0',
      'google-site-verification': 'a7ooX99wNHGQkLtrXE6yZp6A_dw1L1lpWOvVXN-DUgI',
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
