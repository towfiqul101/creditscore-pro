import "./globals.css";

export const metadata = {
  title: "CreditScore Pro | AI-Powered Credit Analysis",
  description: "Get an instant 10-point funding readiness score with a personalized roadmap. Know your exact strengths, weaknesses, and what to fix first.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
