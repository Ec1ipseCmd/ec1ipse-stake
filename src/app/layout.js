import localFont from "next/font/local";
import './globals.css';
import '../styles.css';
import '@solana/wallet-adapter-react-ui/styles.css';

export const metadata = {
  title: 'Ec1ipse Stake',
  description: 'A website to stake your Ore.',
};

const robotoFont = localFont({
  src: "./fonts/Roboto-Regular.ttf", // Adjust if the path differs
  variable: "--font-roboto",
  weight: "400",
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={robotoFont.variable}>
      <body>{children}</body>
    </html>
  );
}
