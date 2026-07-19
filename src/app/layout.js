import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";
import { CartProvider } from "../contexts/CartContext";
import { ToastProvider } from "../contexts/ToastContext";
import BottomNav from "../components/BottomNav";

export const metadata = {
  title: "Hive Bantayan — Sweet Tiramisu & Milkshakes",
  description: "Bantayan Island's premium delivery service for handcrafted tiramisu cake slices and thick creamy milkshakes. Order online now!",
  keywords: "tiramisu, milkshake, delivery, bantayan, bantayan island, dessert, sweet, food, cebu",
  openGraph: {
    title: "Hive Bantayan — Tiramisu & Milkshakes",
    description: "Premium dessert delivery directly to your doorstep in Bantayan Island.",
    url: "https://hive-bantayan-8598e.web.app",
    siteName: "Hive Bantayan",
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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <div className="app-container">
                {children}
                <BottomNav />
              </div>
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
