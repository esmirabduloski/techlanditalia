import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { cn } from '@/lib/utils';

const MOBILE_QUERY = '(max-width: 767px)';

/**
 * Come useIsMobile, ma già corretto al primo render: evita di montare il
 * compilatore in versione desktop e poi rimontarlo subito in versione mobile.
 */
function useIsMobileLayout() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

export interface WorkspaceSidePanel {
  /** Etichetta della scheda su mobile, es. "Codice" o "Gioco" */
  label: string;
  emoji: string;
  node: ReactNode;
  defaultSize?: number;
  minSize?: number;
}

interface LessonWorkspaceProps {
  header: ReactNode;
  content: ReactNode;
  /** Barra di navigazione; `split` = dentro il pannello che scorre, `page` = pagina normale */
  renderNavigation: (variant: 'split' | 'page') => ReactNode;
  /** Compilatore o gioco a destra. Se assente la pagina usa il layout normale del sito. */
  sidePanel?: WorkspaceSidePanel;
  /** Chiave per ricordare la larghezza dei pannelli (localStorage) */
  layoutId: string;
  /** Quando cambia (nuovo task/lezione) si torna in cima e alla scheda Spiegazione */
  resetKey: string;
  themeClass?: string;
  overlays?: ReactNode;
}

/**
 * Layout comune delle pagine lezione/task (studente e insegnante).
 * - Con `sidePanel` su desktop: testo e compilatore affiancati e ridimensionabili.
 * - Con `sidePanel` su telefono: due schede, "Spiegazione" e "Codice"/"Gioco".
 *   Entrambe restano montate, così il codice scritto non si perde cambiando scheda.
 * - Senza `sidePanel`: pagina normale del sito con intestazione in una card.
 */
export function LessonWorkspace({
  header,
  content,
  renderNavigation,
  sidePanel,
  layoutId,
  resetKey,
  themeClass,
  overlays,
}: LessonWorkspaceProps) {
  const isMobile = useIsMobileLayout();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mobileTab, setMobileTab] = useState<'content' | 'side'>('content');

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setMobileTab('content');
  }, [resetKey]);

  if (!sidePanel) {
    return (
      <Layout>
        <div className={cn('max-w-4xl mx-auto px-4 py-8', themeClass)}>
          <div className="rounded-xl border border-border overflow-hidden shadow-sm">
            {header}
          </div>
          {content}
          {renderNavigation('page')}
        </div>
        {overlays}
      </Layout>
    );
  }

  const contentPane = (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      {content}
      {renderNavigation('split')}
    </div>
  );

  return (
    <div className={cn('h-[100dvh] flex flex-col bg-background', themeClass)}>
      {header}

      {isMobile ? (
        <>
          <div role="tablist" aria-label="Sezioni del task" className="grid grid-cols-2 border-b border-border bg-background">
            {([
              ['content', '📖', 'Spiegazione'],
              ['side', sidePanel.emoji, sidePanel.label],
            ] as const).map(([value, emoji, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`lesson-tab-${value}`}
                aria-selected={mobileTab === value}
                aria-controls={`lesson-panel-${value}`}
                onClick={() => setMobileTab(value)}
                className={cn(
                  'py-2.5 text-sm font-semibold border-b-2 transition-colors',
                  mobileTab === value
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <span aria-hidden="true" className="mr-1.5">{emoji}</span>
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 relative">
            <div
              id="lesson-panel-content"
              role="tabpanel"
              aria-labelledby="lesson-tab-content"
              className={cn('absolute inset-0', mobileTab !== 'content' && 'hidden')}
            >
              {contentPane}
            </div>
            <div
              id="lesson-panel-side"
              role="tabpanel"
              aria-labelledby="lesson-tab-side"
              className={cn('absolute inset-0', mobileTab !== 'side' && 'hidden')}
            >
              {sidePanel.node}
            </div>
          </div>
        </>
      ) : (
        <ResizablePanelGroup direction="horizontal" autoSaveId={layoutId} className="flex-1">
          <ResizablePanel defaultSize={100 - (sidePanel.defaultSize ?? 50)} minSize={25}>
            {contentPane}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={sidePanel.defaultSize ?? 50} minSize={sidePanel.minSize ?? 30}>
            {sidePanel.node}
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      {overlays}
    </div>
  );
}
