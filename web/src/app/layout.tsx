import type { Metadata } from "next";
import "./globals.css";

// Metadata is the browser tab title and description, not visible page content.
export const metadata: Metadata = {
  title: "Stock News Aggregator | Market Dashboard",
  description: "Track a stock portfolio alongside relevant market news.",
};

/**
 * Every page in the app is wrapped by this layout. The global stylesheet
 * applies here, while each page supplies its own visible content.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser extensions such as Night Eye can add an attribute to <html>
    // before React starts. This one-level escape hatch prevents that external
    // change from being reported as an application hydration error.
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
