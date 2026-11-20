import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, Geist_Mono } from "next/font/google";
import { Agentation } from "agentation";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteFooter, SiteHeader } from "@/components/app-shell/site-header";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Hack the Lease · Find your people. Find your place.",
    template: "%s · Hack the Lease",
  },
  description:
    "A housing decision tool for groups of four: scores Ann Arbor listings for each roommate's real week, explains the trade-offs and lets the group vote.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider delay={150}>
          <SiteHeader />
          <div className="flex flex-1 flex-col">{children}</div>
          <SiteFooter />
        </TooltipProvider>
        <Toaster theme="light" position="bottom-center" richColors={false} />
        {process.env.NODE_ENV === "development" && <Agentation appName="Hack the Lease" />}
      </body>
    </html>
  );
}
