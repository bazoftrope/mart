import "reflect-metadata";
import "quill/dist/quill.snow.css";
import "react-h5-audio-player/lib/styles.css";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import Layout from "@/components/layout/Layout";
import { onest } from "@/styles/fonts";

const DEFAULT_TITLE = "Marathon Platform";
const DEFAULT_DESCRIPTION =
  "Марафоны по здоровому питанию: программа от ментора, дневник питания, рейтинг и поддержка участников.";

export default function App({ Component, pageProps }: AppProps) {
  return (
    // Класс шрифта нужен здесь, чтобы next/font собрал CSS шрифта (см. src/styles/fonts.ts).
    // Сама переменная `--font-onest` применяется на <html> в _document.tsx.
    <div className={onest.variable}>
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
