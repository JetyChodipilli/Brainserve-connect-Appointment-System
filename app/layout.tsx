import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrainServe Connect | Workplace Access",
  description: "Secure appointments, employee operations and visitor access in BrainServe Connect.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
