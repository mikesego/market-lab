import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Manrope, Newsreader } from "next/font/google";

import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://stocks.mikesego.com"),
  title: { default: "Market Lab — Learn investing by doing", template: "%s · Market Lab" },
  description:
    "A classroom stock-market simulation where students research real companies, manage a $100,000 practice portfolio, and explain every decision.",
  applicationName: "Market Lab",
  category: "education",
  openGraph: {
    title: "Market Lab — Learn investing by doing",
    description: "A serious, joyful stock-market simulation built for classrooms.",
    type: "website",
    siteName: "Market Lab",
    images: [{ url: "/market-lab-social.png", width: 1731, height: 909, alt: "Market Lab educational portfolio illustration" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Market Lab — Learn investing by doing",
    description: "A serious, joyful stock-market simulation built for classrooms.",
    images: ["/market-lab-social.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${manrope.variable} ${newsreader.variable}`} data-scroll-behavior="smooth">
      <body>
        <ClerkProvider
          dynamic
          signInUrl="/teacher/sign-in"
          appearance={{
            variables: {
              colorPrimary: "#c7f36b",
              colorBackground: "#fffdf5",
              colorForeground: "#153d34",
              colorNeutral: "#153d34",
              borderRadius: "0.75rem",
              fontFamily: "var(--font-manrope)",
            },
          }}
        >
          <a className="skip-link" href="#main-content">Skip to content</a>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
