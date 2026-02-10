import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'DropWatch - Hitta utgående domäner',
  description: 'Bevaka domäner i Pending Delete-stadiet',
  // Lägg till verifiering här
  verification: {
    other: {
      'impact-site-verification': 'ca0aaced-7984-4e30-a189-511ccce10bb0',
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
