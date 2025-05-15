import Header from "./Header"
import Footer from "./Footer"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-content">
      <Header />
      <main className="flex-grow max-w-6xl mx-auto p-4">{children}</main>
      <Footer />
    </div>
  )
}
