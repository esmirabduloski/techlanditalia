import * as React from "react";
import { ReactNode, lazy, Suspense, useEffect, useState } from "react";
import { Navbar } from "./Navbar";
import { MobileStickyBar } from "./MobileStickyBar";
import { ParentBottomNav } from "./ParentBottomNav";
import { useLocation } from "react-router-dom";
import { isPrivateAreaPath } from "@/lib/privateAreas";

// Lazy: footer is below-the-fold and triggers a Supabase query for courses
const Footer = lazy(() =>
  import("./Footer").then((m) => ({ default: m.Footer }))
);
const ChatWidget = lazy(() =>
  import("@/components/chat/ChatWidget").then((m) => ({ default: m.ChatWidget }))
);

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [showDeferred, setShowDeferred] = useState(false);
  // La navbar è alta 80px (h-20): nelle aree private il contenuto parte sotto.
  // Le pagine pubbliche restano a pt-16 perché i loro hero sono disegnati su quello.
  const { pathname } = useLocation();
  const topPadding = isPrivateAreaPath(pathname) ? "pt-20" : "pt-16";

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
      <main id="main-content" role="main" className={`flex-1 ${topPadding} pb-20 md:pb-0`} tabIndex={-1}>
        {children}
      </main>
      {showDeferred && (
        <Suspense fallback={null}>
          <Footer />
          <ChatWidget />
        </Suspense>
      )}
      <MobileStickyBar />
      <ParentBottomNav />
    </div>
  );
}
