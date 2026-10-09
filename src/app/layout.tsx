import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Source_Sans_3 } from "next/font/google";
import { Nav } from "@/components/demo/Nav";
import { recordedMode } from "@/lib/demo/recorded";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], axes: ["opsz"], variable: "--font-fraunces" });
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Neo GraderBot",
  description: "A grading assistant for software engineering teachers. Grade a page of real student responses, then compare with GraderBot.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${sourceSans.variable} ${jetbrains.variable}`}>
      <body>
        <Nav />
        {recordedMode() && (
          <p role="status" className="border-b border-warn/30 bg-warn-soft px-6 py-2 text-center text-sm text-warn">
            Live grading is paused: this demo is showing recorded examples. GraderBot&apos;s grades and notes come from an earlier run of
            the same agent, so nothing here calls a model, and the judge and &ldquo;Try your own&rdquo; are off.
          </p>
        )}
        {children}
      </body>
    </html>
  );
}
