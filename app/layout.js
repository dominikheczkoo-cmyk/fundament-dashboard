import "./globals.css";

export const metadata = {
  title: "Fundament — přehled měn",
  description: "Přehled forexového fundamentu z Notionu",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
