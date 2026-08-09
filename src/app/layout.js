import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";
import { CartProvider } from "../contexts/CartContext";
import { ToastProvider } from "../contexts/ToastContext";
import Header from "../components/Header";

export const metadata = {
  title: "Bantayan Hive — Sweet Tiramisu & Milkshakes",
  description: "Bantayan Island's premium delivery service for handcrafted tiramisu cake slices and thick creamy milkshakes. Order online now!",
  keywords: "tiramisu, milkshake, delivery, bantayan, bantayan island, dessert, sweet, food, cebu",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Bantayan Hive — Tiramisu & Milkshakes",
    description: "Premium dessert delivery directly to your doorstep in Bantayan Island.",
    url: "https://bantayan-hive-island.vercel.app",
    siteName: "Bantayan Hive",
    locale: "en_PH",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <div className="app-container">
                <Header />
                {children}
              </div>
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
