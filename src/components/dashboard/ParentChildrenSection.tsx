import { useState, useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { certificateClient } from "@/lib/certificateClient";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, CalendarDays, ClipboardList, CalendarCheck, CreditCard, MessageCircle, Trophy, Award, History, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvatarDisplay } from "@/components/gamification/AvatarSelector";
import { getLevelFromPoints } from "@/components/gamification/LevelBadge";
import { StreakDisplay } from "@/components/dashboard/StreakDisplay";
import { ParentBadgesSection } from "@/components/dashboard/ParentBadgesSection";
import { ParentCommentsSection } from "@/components/dashboard/ParentCommentsSection";
import { ChildLessonCalendar } from "@/components/dashboard/ChildLessonCalendar";
import { ChildHomeworkHistory } from "@/components/dashboard/ChildHomeworkHistory";
import { ChildAttendanceHistory } from "@/components/dashboard/ChildAttendanceHistory";
import { ParentPaymentHistory } from "@/components/dashboard/ParentPaymentHistory";
import { ChildSummaryCard, type ChildSectionId } from "@/components/dashboard/ChildSummaryCard";
import { ChildPasswordDialog } from "@/components/dashboard/ChildPasswordDialog";
import { ChildTimeline, TimelineHint } from "@/components/dashboard/ChildTimeline";
import { CertificateCard } from "@/components/certificates/CertificateCard";
import { SkillMapView } from "@/components/skills/SkillMap";
import { useStudentStreaks } from "@/hooks/useStudentStreaks";
import { useSkillMap } from "@/hooks/useSkillMap";
import { buildSkillMap, startedCount, type SkillMapEntry } from "@/lib/skillMap";
import { localDateKey, nextLesson } from "@/lib/childProgress";
import { addDaysIso, romeToday } from "@/lib/courseProposal";
import type { CourseCertificate } from "@/lib/certificate";
import { fetchChildIds } from "@/lib/familyClient";

/** Un attestato sbloccato da meno di così resta "nuovo" e la sezione parte aperta. */
const NEW_CERTIFICATE_DAYS = 14;
const isNewCertificate = (c: CourseCertificate) => c.issued_on >= addDaysIso(romeToday(), -NEW_CERTIFICATE_DAYS);
import {
  useChildAttendance,
  useChildBalance,
  useChildCertificates,
  useChildComments,
  useChildHomework,
  useChildSchedule,
} from "@/hooks/useChildProgressData";

interface Child {
  id: string;
  full_name: string;
  email: string | null;
  username: string | null;
  avatar_id: number;
  total_points: number;
  created_at?: string | null;
}

interface ChildCourse {
  courseId: string;
  courseTitle: string;
  courseEmoji: string;
  groupIds: string[];
}

export function ParentChildrenSection() {
  const { effectiveUserId, isImpersonating } = useEffectiveUserId();
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChild, setActiveChild] = useState<string>("");

  useEffect(() => {
    if (!effectiveUserId) return;
    (async () => {
      try {
        const childIds = await fetchChildIds(supabase, effectiveUserId);
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email, username, avatar_id, total_points, created_at")
          .in("id", childIds);
        setChildren(data || []);
        if (data?.length) {
          let first = data[0].id;
          // Link dell'email "attestato pronto": apre il figlio con l'attestato più recente
          if (data.length > 1 && window.location.hash === "#certificazioni") {
            const { data: latest } = await certificateClient
              .from("course_certificates")
              .select("student_id")
              .in("student_id", data.map((c) => c.id))
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (latest) first = latest.student_id;
          }
          setActiveChild(first);
        }
      } catch (error) {
        console.error("Error fetching children data:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [effectiveUserId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (children.length === 0) return null;

  const activeChildData = children.find((c) => c.id === activeChild) ?? children[0];

  return (
    <section className="space-y-4" aria-labelledby="parent-children-title">
      <h2 id="parent-children-title" className="text-xl font-bold text-foreground flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" aria-hidden="true" />
        {children.length > 1 ? "I tuoi figli" : activeChildData.full_name}
      </h2>

      {/* Più figli: schede che scorrono in orizzontale invece di andare a capo */}
      {children.length > 1 && (
        <div className="-mx-4 px-4 overflow-x-auto">
          <div role="tablist" aria-label="Scegli il figlio" className="flex gap-2 w-max pb-1">
            {children.map((child) => {
              const selected = child.id === activeChildData.id;
              return (
                <button
                  key={child.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveChild(child.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border pl-1 pr-4 min-h-[48px] whitespace-nowrap transition-colors",
                    selected ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted",
                  )}
                >
                  <AvatarDisplay avatarId={child.avatar_id} level={getLevelFromPoints(child.total_points).level} size="sm" showLevel={false} />
                  <span className="font-medium">{child.full_name.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ChildDashboard key={activeChildData.id} child={activeChildData} canManagePassword={!isImpersonating} />
    </section>
  );
}

function ChildDashboard({ child, canManagePassword }: { child: Child; canManagePassword: boolean }) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [courses, setCourses] = useState<ChildCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [coursesLoading, setCoursesLoading] = useState(true);
  // Da tablet in su il calendario parte aperto; sul telefono tutto chiuso, c'è il riepilogo
  const [openSections, setOpenSections] = useState<string[]>(() =>
    typeof window !== "undefined" && window.matchMedia?.("(min-width: 768px)").matches ? ["calendario"] : [],
  );
  const { hash } = useLocation();
  const { data: certificates, isLoading: certificatesLoading } = useChildCertificates(child.id);
  // Le competenze si sommano tra un corso e l'altro: la mappa non segue il corso scelto
  const { data: skillRows, isLoading: skillsLoading } = useSkillMap(child.id);
  const skillEntries = skillRows ? buildSkillMap(skillRows) : [];

  // Attestato appena sbloccato: la sezione Certificazioni parte aperta
  useEffect(() => {
    if (certificates?.some(isNewCertificate)) {
      setOpenSections((prev) => (prev.includes("certificazioni") ? prev : ["certificazioni", ...prev]));
    }
  }, [certificates]);

  useEffect(() => {
    (async () => {
      setCoursesLoading(true);
      try {
        const { data } = await supabase
          .from("group_students")
          .select(`
            group_id,
            group:group_id (
              id,
              course_id,
              course:course_id (
                id,
                title,
                emoji
              )
            )
          `)
          .eq("student_id", child.id);

        const courseMap = new Map<string, ChildCourse>();
        ((data || []) as unknown as { group: { id: string; course: { id: string; title: string; emoji: string } } }[]).forEach((gs) => {
          const c = gs.group.course;
          if (!courseMap.has(c.id)) courseMap.set(c.id, { courseId: c.id, courseTitle: c.title, courseEmoji: c.emoji, groupIds: [] });
          courseMap.get(c.id)!.groupIds.push(gs.group.id);
        });
        const list = Array.from(courseMap.values());
        setCourses(list);
        if (list.length > 0) setSelectedCourseId(list[0].courseId);
      } catch (error) {
        console.error("Error fetching child courses:", error);
      } finally {
        setCoursesLoading(false);
      }
    })();
  }, [child.id]);

  const openSection = (id: ChildSectionId) => {
    setOpenSections((prev) => (prev.includes(id) ? prev : [...prev, id]));
    // Dopo l'apertura, porta la sezione sotto la barra in alto
    setTimeout(() => {
      document.getElementById(`sezione-${child.id}-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  // Link diretti (es. /area-riservata#calendario dalla barra in basso)
  useEffect(() => {
    const id = hash.replace("#", "") as ChildSectionId;
    if (coursesLoading || certificatesLoading || skillsLoading) return;
    const available =
      id === "certificazioni" ? !!certificates?.length
      : id === "competenze" ? skillEntries.length > 0
      : ["calendario", "compiti", "presenze", "saldo", "commenti", "percorso", "traguardi"].includes(id);
    if (available) {
      openSection(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, coursesLoading, certificatesLoading, skillsLoading]);

  const selectedCourse = courses.find((c) => c.courseId === selectedCourseId);
  const groupIds = selectedCourse?.groupIds;
  const courseIds = selectedCourse ? [selectedCourse.courseId] : undefined;
  // Sezioni presenti: la linea del tempo porta solo a queste
  const sections: ChildSectionId[] = [
    ...(certificates?.length ? ["certificazioni" as const] : []),
    ...(skillEntries.length > 0 && courses.length > 0 ? ["competenze" as const] : []),
    ...(courses.length > 0 ? ["traguardi" as const] : []),
  ];
  const timeline = (
    <Section childId={child.id} id="percorso" icon={History} title="Linea del tempo" hint={<TimelineHint child={child} skills={skillEntries} />}>
      <ChildTimeline child={child} skills={skillEntries} sections={sections} onOpenSection={openSection} />
    </Section>
  );

  if (coursesLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {courses.length > 1 && (
        <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
          <SelectTrigger className="w-full sm:w-[300px] min-h-[44px]" aria-label="Corso">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {courses.map((course) => (
              <SelectItem key={course.courseId} value={course.courseId}>
                {course.courseEmoji} {course.courseTitle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {courses.length === 1 && (
        <p className="text-sm text-muted-foreground">
          Corso: {courses[0].courseEmoji} {courses[0].courseTitle}
        </p>
      )}

      {courses.length === 0 ? (
        <>
          <ChildSummaryCard
            child={child}
            onOpenSection={openSection}
            onNewPassword={canManagePassword ? () => setPasswordOpen(true) : undefined}
          />
          {/* Corsi finiti: restano attestati e percorso */}
          <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="space-y-3">
            {certificates && certificates.length > 0 && (
              <CertificatesSection childId={child.id} childName={child.full_name} certificates={certificates} />
            )}
            {timeline}
          </Accordion>
          <Card className="border-dashed">
            <CardContent className="py-6 text-center">
              <p className="text-sm text-muted-foreground">Nessun corso attivo per {child.full_name}</p>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <ChildSummaryCard
            child={child}
            groupIds={groupIds}
            courseIds={courseIds}
            onOpenSection={openSection}
            onNewPassword={canManagePassword ? () => setPasswordOpen(true) : undefined}
          />

          <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="space-y-3">
            {certificates && certificates.length > 0 && (
              <CertificatesSection childId={child.id} childName={child.full_name} certificates={certificates} />
            )}
            <Section childId={child.id} id="calendario" icon={CalendarDays} title="Calendario lezioni" hint={<ScheduleHint childId={child.id} groupIds={groupIds} />}>
              <ChildLessonCalendar childId={child.id} childName={child.full_name} groupIds={groupIds} />
            </Section>
            <Section childId={child.id} id="compiti" icon={ClipboardList} title="Compiti" hint={<HomeworkHint childId={child.id} courseIds={courseIds} />}>
              <ChildHomeworkHistory childId={child.id} childName={child.full_name} courseIds={courseIds} />
            </Section>
            <Section childId={child.id} id="presenze" icon={CalendarCheck} title="Presenze" hint={<AttendanceHint childId={child.id} groupIds={groupIds} />}>
              <ChildAttendanceHistory childId={child.id} childName={child.full_name} groupIds={groupIds} embedded />
            </Section>
            <Section childId={child.id} id="saldo" icon={CreditCard} title="Lezioni e pagamenti" hint={<BalanceHint childId={child.id} />}>
              <ParentPaymentHistory childId={child.id} childName={child.full_name} />
            </Section>
            <Section childId={child.id} id="commenti" icon={MessageCircle} title="Commenti degli insegnanti" hint={<CommentsHint childId={child.id} />}>
              <ParentCommentsSection childId={child.id} childName={child.full_name} />
            </Section>
            {skillEntries.length > 0 && (
              <SkillsSection childId={child.id} childName={child.full_name} entries={skillEntries} />
            )}
            {timeline}
            <Section childId={child.id} id="traguardi" icon={Trophy} title="Traguardi" hint={`Livello ${getLevelFromPoints(child.total_points).level}`}>
              <Achievements child={child} />
            </Section>
          </Accordion>
        </>
      )}

      {canManagePassword && <ChildPasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} child={child} />}
    </div>
  );
}

function Section({
  childId,
  id,
  icon: Icon,
  title,
  hint,
  children,
}: {
  childId: string;
  id: ChildSectionId;
  icon: typeof CalendarDays;
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AccordionItem
      value={id}
      id={`sezione-${childId}-${id}`}
      className="rounded-xl border bg-card px-4 scroll-mt-24"
    >
      <AccordionTrigger className="min-h-[56px] py-3 gap-3 hover:no-underline">
        <span className="flex items-center gap-2 font-semibold text-left">
          <Icon className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
          {title}
        </span>
        {hint && <span className="ml-auto text-sm font-normal text-muted-foreground whitespace-nowrap">{hint}</span>}
      </AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}

/** Attestati di fine corso: la sezione esiste solo dopo lo sblocco dell'insegnante. */
function CertificatesSection({ childId, childName, certificates }: { childId: string; childName: string; certificates: CourseCertificate[] }) {
  const queryClient = useQueryClient();
  const hasNew = certificates.some(isNewCertificate);
  const firstName = childName.split(" ")[0];
  // Link pubblico cambiato: aggiorna l'attestato nella cache, senza ricaricare
  const updated = (next: CourseCertificate) =>
    queryClient.setQueryData<CourseCertificate[]>(["child-certificates", childId], (old) =>
      old?.map((c) => (c.id === next.id ? { ...c, ...next } : c)),
    );
  const hint = hasNew ? (
    <span className="text-primary font-medium">🎓 Nuovo!</span>
  ) : certificates.length === 1 ? "1 attestato" : `${certificates.length} attestati`;
  return (
    <Section childId={childId} id="certificazioni" icon={Award} title="Certificazioni" hint={hint}>
      <div className="space-y-3 pb-1" data-testid="parent-certificates">
        {hasNew && (
          <p className="text-sm text-muted-foreground">
            Complimenti a {firstName}! Ecco il suo attestato di fine corso: scaricalo, stampalo o condividilo con chi vuoi.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {certificates.map((c) => (
            <CertificateCard
              key={c.id}
              certificate={c}
              sharing={{ viewer: "parent", canPublish: true, studentFirstName: firstName, onChange: updated }}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}

/** Mappa delle competenze: compare quando ci sono lezioni collegate o una valutazione. */
function SkillsSection({ childId, childName, entries }: { childId: string; childName: string; entries: SkillMapEntry[] }) {
  return (
    <Section childId={childId} id="competenze" icon={MapIcon} title="Competenze" hint={`${startedCount(entries)} su ${entries.length} avviate`}>
      <div className="space-y-4 pb-1" data-testid="parent-skill-map">
        <p className="text-sm text-muted-foreground">
          Cosa sa fare {childName.split(" ")[0]} con il coding, in tutti i suoi corsi. Tocca «Perché?» per vedere da quali lezioni e compiti viene ogni livello.
        </p>
        <SkillMapView entries={entries} variant="parent" />
      </div>
    </Section>
  );
}

// --- Riassunti nelle intestazioni delle sezioni (dalle stesse query, già in cache) ---

function ScheduleHint({ childId, groupIds }: { childId: string; groupIds?: string[] }) {
  const { data } = useChildSchedule(childId, groupIds);
  const next = data ? nextLesson(data) : null;
  if (!next) return null;
  return <>{next.lesson_date === localDateKey() ? "Oggi" : format(new Date(`${next.lesson_date}T12:00:00`), "EEE d MMM", { locale: it })}</>;
}

function HomeworkHint({ childId, courseIds }: { childId: string; courseIds?: string[] }) {
  const { data } = useChildHomework(childId, courseIds);
  if (!data || data.counts.all === 0) return null;
  const { missing } = data.counts;
  if (missing) return <span className="text-red-700 dark:text-red-400 font-medium">{missing} {missing === 1 ? "mancante" : "mancanti"}</span>;
  if (data.counts.pending) return <>{data.counts.pending} da fare</>;
  return <span className="text-green-700 dark:text-green-400">In regola</span>;
}

function AttendanceHint({ childId, groupIds }: { childId: string; groupIds?: string[] }) {
  const { data } = useChildAttendance(childId, groupIds);
  if (!data?.stats.total) return null;
  return <>{data.stats.percentage}%</>;
}

function BalanceHint({ childId }: { childId: string }) {
  const { data } = useChildBalance(childId);
  if (!data) return null;
  return <>{data.balance} {data.balance === 1 ? "rimasta" : "rimaste"}</>;
}

function CommentsHint({ childId }: { childId: string }) {
  const { data } = useChildComments(childId);
  if (!data?.length) return null;
  return <>{data.length}</>;
}

function Achievements({ child }: { child: Child }) {
  const { streaks, loading } = useStudentStreaks(child.id);
  return (
    <div className="space-y-4">
      {streaks && !loading && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">🔥 Serie consecutive</h4>
          <StreakDisplay
            compact
            homeworkStreak={streaks.homework_streak}
            attendanceStreak={streaks.attendance_streak}
            bestHomeworkStreak={streaks.best_homework_streak}
            bestAttendanceStreak={streaks.best_attendance_streak}
          />
        </div>
      )}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">🏆 Badge</h4>
        <ParentBadgesSection childId={child.id} childName={child.full_name} />
      </div>
    </div>
  );
}
