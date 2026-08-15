import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { Be_Vietnam_Pro } from "next/font/google"
import { AuthGate } from "@/components/auth-gate"
import "./globals.css"

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["vietnamese"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-be-vietnam-pro",
})

export const metadata: Metadata = {
  title: "Sổ Hụi",
  description: "Phần mềm quản lý hụi – Sổ Hụi",
  generator: "v0.app",
}

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#2563c7",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} bg-background`}>
      <body className="antialiased font-sans">
        <AuthGate>{children}</AuthGate>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
