import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DECA", template: "%s | DECA" },
  description: "Good work starts with the right connection.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f4a38" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
