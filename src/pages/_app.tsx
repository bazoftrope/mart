import "reflect-metadata";
import "quill/dist/quill.snow.css";
import "react-h5-audio-player/lib/styles.css";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Layout from "@/components/layout/Layout";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}
