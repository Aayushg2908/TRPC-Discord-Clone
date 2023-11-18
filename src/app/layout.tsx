import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { dark } from "@clerk/themes";
import { cn } from "@/lib/utils";
import TRPCProvider from "@/components/providers/trpc-provider";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import { ModalProvider } from "@/components/providers/modal-provider";
import { SocketProvider } from "@/components/providers/socket-provider";

const font = Open_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Discord",
  description: "This is a Discord Clone",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <TRPCProvider>
          <body className={cn(font.className, "bg-white dark:bg-[#313338]")}>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem={false}
              storageKey="discord-theme"
            >
              <SocketProvider>
                <ModalProvider />
                <Toaster />
                {children}
              </SocketProvider>
            </ThemeProvider>
          </body>
        </TRPCProvider>
      </html>
    </ClerkProvider>
  );
}
