import "reflect-metadata";
import "quill/dist/quill.snow.css";
import "react-h5-audio-player/lib/styles.css";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Golos_Text } from "next/font/google";
import Layout from "@/components/layout/Layout";

/**
 * Базовый шрифт дизайн-системы. CSS-переменную `--font-golos` подхватывает токен
 * `--font-family-base` из globals.css, поэтому font-family задаётся один раз здесь.
 */
const golos = Golos_Text({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-golos",
  display: "swap",
});

const DEFAULT_TITLE = "Marathon Platform";
const DEFAULT_DESCRIPTION =
  "Марафоны по здоровому питанию: программа от ментора, дневник питания, рейтинг и поддержка участников.";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={golos.variable}>
      <Head>
        <title>{DEFAULT_TITLE}</title>
        <meta name="description" content={DEFAULT_DESCRIPTION} />
      </Head>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </div>
  );
}
