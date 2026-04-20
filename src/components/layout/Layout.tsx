import { ReactNode, lazy, Suspense, useEffect, useState } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useIsMobile } from "@/hooks/use-mobile";

const lazyRetry = <T,>(importFn: () => Promise<T>) =>
  lazy(() =>
    importFn().catch(() => {
      window.location.reload();
      return importFn();
    })
  );

const ChatWidget = lazy(() =>
  import("@/components/chat/ChatWidget").then((m) => ({ default: m.ChatWidget }))
);

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [showDeferred, setShowDeferred] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Defer footer + chat widget until the browser is idle to keep TBT/FCP low.
    const idle =
      (window as any).requestIdleCallback ||
      ((cb: () => void) => setTimeout(cb, 2500));
    const cancelIdle =
      (window as any).cancelIdleCallback || ((id: number) => clearTimeout(id));
    const handle = idle(() => setShowDeferred(true), { timeout: 4000 });
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
      {showDeferred && <Footer />}
      {showDeferred && !isMobile && (
        <Suspense fallback={null}>
          <ChatWidget />
        </Suspense>
      )}
    </div>
  );
}
