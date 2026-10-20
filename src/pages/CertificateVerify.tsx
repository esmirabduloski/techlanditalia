import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BadgeCheck, Loader2, Lock, Search, ShieldCheck, Star, XCircle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { certificateClient } from "@/lib/certificateClient";
import {
  CERTIFICATE_HOURS,
  CERTIFICATE_LESSONS,
  CERTIFICATE_VERIFY_PATH,
  formatHours,
  normalizeCertificateCode,
  type VerifiedCertificate,
} from "@/lib/certificate";
import { shortDate } from "@/lib/courseProposal";

/**
 * Verifica pubblica di un attestato (0064_certificate_sharing), senza account:
 * - /attestato            modulo per scrivere il codice stampato sull'attestato;
 * - /attestato/<codice>   esito, la pagina del QR code e dei link su LinkedIn.
 * Se la famiglia non l'ha reso pubblico si vedono solo iniziali, corso e data.
 * Non indicizzata: sono dati di minori, anche quando pubblici.
 */

type State =
  | { kind: "loading" }
  | { kind: "found"; certificate: VerifiedCertificate }
  | { kind: "not-found" }
  | { kind: "error" };

function CodeForm({ initial = "" }: { initial?: string }) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initial);
  const [invalid, setInvalid] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const code = normalizeCertificateCode(value);
    if (!code) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    navigate(`${CERTIFICATE_VERIFY_PATH}/${encodeURIComponent(code)}`);
  };

  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      <label htmlFor="certificate-code" className="text-sm font-medium">
        Codice dell'attestato
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          id="certificate-code"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="TL-2026-AB3CD"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="min-h-[48px] font-mono uppercase"
          aria-invalid={invalid}
          aria-describedby="certificate-code-hint"
        />
        <Button type="submit" size="lg" className="min-h-[48px]">
          <Search className="w-4 h-4 mr-2" aria-hidden="true" />
          Verifica
        </Button>
      </div>
      <p id="certificate-code-hint" className={invalid ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
        {invalid
          ? "Questo non sembra un codice: controlla di averlo copiato per intero."
          : "Lo trovi in basso al centro dell'attestato, dopo «Codice attestato»."}
      </p>
    </form>
  );
}

function CertificatePreview({ certificate: c }: { certificate: VerifiedCertificate }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    import("@/lib/certificatePdf")
      .then((m) =>
        m.certificatePreviewUrl({ ...c, teacher_name: c.teacher_name ?? "" }, { verifiable: true }),
      )
      .then((u) => {
        if (cancelled) URL.revokeObjectURL(u);
        else setSrc((url = u));
      })
      .catch(() => {
        // Senza anteprima restano i dati qui sotto
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [c]);

  return (
    <div className="aspect-[842/595] rounded-xl overflow-hidden border bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-950/30 dark:to-cyan-950/30">
      {src && (
        <img
          src={src}
          alt={`Attestato di ${c.student_name}: ${c.course_title}`}
          className="w-full h-full object-contain"
        />
      )}
    </div>
  );
}

function SkillList({ title, skills, icon }: { title: string; skills: string[]; icon: "check" | "star" }) {
  if (skills.length === 0) return null;
  return (
    <div>
      <h2 className="text-xs font-bold tracking-wider uppercase text-muted-foreground mb-2">{title}</h2>
      <ul className="space-y-1.5">
        {skills.map((s) => (
          <li key={s} className="flex items-start gap-2 text-sm">
            {icon === "check" ? (
              <BadgeCheck className="w-4 h-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <Star className="w-4 h-4 mt-0.5 shrink-0 text-tech-teal" aria-hidden="true" />
            )}
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Verified({ certificate: c }: { certificate: VerifiedCertificate }) {
  const facts: [string, string][] = [
    [c.is_public ? "Studente" : "Iniziali dello studente", c.student_name],
    ["Corso", `${c.course_emoji ? `${c.course_emoji} ` : ""}${c.course_title}`],
    ["Durata", `${CERTIFICATE_LESSONS} lezioni · ${formatHours(CERTIFICATE_HOURS)} ore di coding`],
    ["Fine del corso", shortDate(c.issued_on)],
    ...(c.teacher_name ? ([["Insegnante", c.teacher_name]] as [string, string][]) : []),
    ["Codice", c.code],
  ];

  return (
    <div className="space-y-6" data-testid="certificate-verified">
      <div className="flex items-start gap-3 rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
        <ShieldCheck className="w-8 h-8 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Attestato autentico</h1>
          <p className="text-muted-foreground">
            Rilasciato da TECHLAND, scuola di coding per ragazzi, a chi ha completato il corso.
          </p>
        </div>
      </div>

      {c.is_public && <CertificatePreview certificate={c} />}

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 rounded-xl border bg-card p-4">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={label === "Codice" ? "font-mono font-semibold" : "font-semibold"}>{value}</dd>
          </div>
        ))}
      </dl>

      {c.is_public ? (
        <div className="grid gap-6 sm:grid-cols-2 rounded-xl border bg-card p-4">
          <SkillList title="Competenze tecniche" skills={c.hard_skills} icon="check" />
          <SkillList title="Competenze trasversali" skills={c.soft_skills} icon="star" />
        </div>
      ) : (
        <p className="flex gap-2 text-sm text-muted-foreground">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          Per proteggere i dati dei ragazzi mostriamo solo le iniziali. Nome completo e competenze compaiono se la
          famiglia rende pubblico l'attestato.
        </p>
      )}
    </div>
  );
}

export default function CertificateVerify() {
  const { code: rawCode } = useParams();
  const code = rawCode ? normalizeCertificateCode(rawCode) : null;
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!rawCode) return;
    if (!code) {
      setState({ kind: "not-found" });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    certificateClient.rpc("verify_certificate", { p_code: code }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setState({ kind: "error" });
      else if (data && data.length > 0) setState({ kind: "found", certificate: data[0] });
      else setState({ kind: "not-found" });
    });
    return () => {
      cancelled = true;
    };
  }, [rawCode, code]);

  const title =
    state.kind === "found" && state.certificate.is_public
      ? `Attestato di ${state.certificate.student_name}: ${state.certificate.course_title}`
      : "Verifica attestato";

  return (
    <Layout>
      <SEOHead
        title={`${title} | TECHLAND`}
        description="Verifica l'autenticità di un attestato di fine corso TECHLAND con il codice o il QR code stampato sull'attestato."
        canonical={CERTIFICATE_VERIFY_PATH}
        noIndex
      />
      <section className="tech-section">
        <div className="tech-container">
          <div className="max-w-2xl mx-auto space-y-8">
            {!rawCode ? (
              <div className="space-y-6">
                <div className="text-center space-y-3">
                  <ShieldCheck className="w-12 h-12 mx-auto text-primary" aria-hidden="true" />
                  <h1 className="text-3xl md:text-4xl font-bold">Verifica un attestato</h1>
                  <p className="text-muted-foreground">
                    Ogni attestato TECHLAND ha un codice e un QR code: inquadralo con il telefono o scrivi qui il codice
                    per controllare che sia autentico.
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <CodeForm />
                </div>
              </div>
            ) : state.kind === "loading" ? (
              <div className="flex justify-center py-16" role="status" aria-label="Verifica in corso">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : state.kind === "found" ? (
              <Verified certificate={state.certificate} />
            ) : (
              <div className="space-y-6" data-testid="certificate-not-found">
                <div className="flex items-start gap-3 rounded-xl border-2 border-destructive/40 bg-destructive/5 p-4">
                  <XCircle className="w-8 h-8 shrink-0 text-destructive" aria-hidden="true" />
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold">
                      {state.kind === "error" ? "Verifica non riuscita" : "Nessun attestato con questo codice"}
                    </h1>
                    <p className="text-muted-foreground">
                      {state.kind === "error"
                        ? "Non siamo riusciti a controllare il codice: riprova tra qualche istante."
                        : "Controlla di aver scritto il codice per intero. Se il dubbio resta, scrivici a info@techlanditalia.it."}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <CodeForm initial={code ?? rawCode} />
                </div>
              </div>
            )}

            {(!rawCode || state.kind !== "loading") && (
              <div className="rounded-xl bg-gradient-to-br from-primary/10 to-tech-teal/10 p-6 text-center space-y-3">
                <p className="font-semibold">Corsi di coding online per bambini e ragazzi dai 5 ai 18 anni</p>
                <Button asChild size="lg">
                  <Link to="/corsi">Scopri i corsi TECHLAND</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
