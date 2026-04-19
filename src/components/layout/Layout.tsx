import { ReactNode, lazy, Suspense, useEffect, useState } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

// Defer ChatWidget: only loads after page is idle / user interacts
const ChatWidget = lazy(() => import("@/components/chat/ChatWidget").then(m => ({ default: m.ChatWidget })));

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    // Defer until browser idle (or 3s fallback) to free main thread for LCP
    if (typeof window === "undefined") return;
    const idle = (window as any).requestIdleCallback as undefined | ((cb: () => void, opts?: { timeout: number }) => number);
    if (idle) {
      const id = idle(() => setShowChat(true), { timeout: 3000 });
      return () => (window as any).cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setShowChat(true), 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header>
        <Navbar />
      </header>
      <main id="main-content" role="main" className="flex-1 pt-16" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      {showChat && (
        <Suspense fallback={null}>
          <ChatWidget />
        </Suspense>
      )}
    </div>
  );
}
