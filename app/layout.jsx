import './globals.css';

export const metadata = {
  title: 'AI Receptionist',
  description: 'Voice receptionist: classify intent, reply by speech, email for issues and bookings.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
