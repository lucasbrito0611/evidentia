import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Evidentia — Verificador de Fake News com IA",
  description:
    "Verifique a credibilidade de notícias, títulos e links com inteligência artificial. O Evidentia analisa informações e retorna um score de confiabilidade para combater a desinformação.",
  keywords: ["fake news", "verificador de notícias", "fact-checking", "desinformação", "IA", "inteligência artificial"],
  authors: [{ name: "Evidentia" }],
  openGraph: {
    title: "Evidentia — Verificador de Fake News com IA",
    description: "Verifique a credibilidade de notícias com inteligência artificial.",
    type: "website",
    locale: "pt_BR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
