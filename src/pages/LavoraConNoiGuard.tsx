import { lazy, Suspense } from 'react';
import { useSiteSetting } from '@/hooks/useSiteSetting';
import { SEOHead } from '@/components/seo/SEOHead';

const LavoraConNoi = lazy(() => import('@/pages/LavoraConNoi'));
const NotFound = lazy(() => import('@/pages/NotFound'));

export default function LavoraConNoiGuard() {
  const { value: visible, isLoading } = useSiteSetting<boolean>('lavora_con_noi_visible', true);

  if (isLoading) {
    return (
      <>
        {/* Head anche in loading: è lo stato catturato dall'HTML statico a build-time */}
        <SEOHead
          title="Lavora con Noi - Insegna Coding ai Ragazzi | TECHLAND"
          description="Entra nel team TECHLAND: cerchiamo docenti di coding per bambini e ragazzi. Lezioni online in piccoli gruppi, formazione e flessibilità. Candidati ora!"
          canonical="/lavora-con-noi"
        />
        <div role="status" aria-busy="true" aria-label="Caricamento pagina" className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    );
  }

  return (
    <Suspense fallback={null}>
      {visible ? <LavoraConNoi /> : <NotFound />}
    </Suspense>
  );
}
