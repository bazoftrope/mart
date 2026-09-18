import { Html, Head, Main, NextScript } from "next/document";
import { onest } from "@/styles/fonts";

export default function Document() {
  return (
    // `onest.variable` задаёт `--font-onest` на <html>, чтобы её видел токен
    // `--font-family-base` из `:root` (см. src/styles/fonts.ts).
    <Html lang="ru" className={onest.variable}>
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
