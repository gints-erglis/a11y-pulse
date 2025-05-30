import type { AppProps } from "next/app"
import { SessionProvider } from "next-auth/react"
import Layout from "@/components/Layout"
import '../scss/style.scss'

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </SessionProvider>
  )
}
