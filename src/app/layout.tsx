import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "Djaber.ai - AI-Powered Social Media Agent",
  description: "Let AI handle your customer conversations on Facebook & Instagram. Connect your pages and let our intelligent agent respond to your clients 24/7.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="antialiased h-full">
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
