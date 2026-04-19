import { ReactNode, lazy, Suspense, useEffect, useState } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

const ChatWidget = lazy(() =>
  import("@/components/chat/ChatWidget").then((m) => ({ default: m.ChatWidget }))
);

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    // Defer chat widget loading until browser is idle to keep TBT/FCP low.
    const idle =
      (window as any).requestIdleCallback ||
      ((cb: () => void) => setTimeout(cb, 2500));
    const cancelIdle =
      (window as any).cancelIdleCallback || ((id: number) => clearTimeout(id));
    const handle = idle(() => setShowChat(true), { timeout: 4000 });
    return () => cancelIdle(handle);
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
