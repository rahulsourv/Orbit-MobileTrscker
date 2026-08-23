import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";

import "./globals.css";
import { SessionBootstrap } from "@/components/layout/SessionBootstrap";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Orbit — Know where your devices are",
    template: "%s · Orbit",
  },
  description:
    "A privacy-first way to keep track of your own phones, laptops and tablets. Devices only report once you register them, and you can switch tracking off at any time.",
};

export const viewport = {
  themeColor: "#06070a",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <SessionBootstrap />
        <div className="relative z-10">{children}</div>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#151922",
              border: "1px solid #2a3140",
              color: "#f2f5f9",
            },
          }}
        />
      </body>
    </html>
  );
}
