import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { ChatWidget } from "@/components/chat/ChatWidget";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header>
        <Navbar />
      </header>
      <main id="main-content" role="main" className="flex-1 pt-16" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
