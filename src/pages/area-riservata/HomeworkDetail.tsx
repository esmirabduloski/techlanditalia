import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUpload } from "@/components/homework/FileUpload";
import { 
  ArrowLeft, 
  Download, 
  Paperclip, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Send,
  FileText,
  Code,
  Calendar,
  Trophy,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Attachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

interface HomeworkDetails {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  points_reward: number;
  due_date: string | null;
  attachments: Attachment[];
  lesson: {
    id: string;
    title: string;
    lesson_number: number;
    course: {
      id: string;
      title: string;
      emoji: string;
      slug: string;
    };
  };
}

interface Submission {
  id: string;
  status: string;
  submitted_at: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  notes: string | null;
  teacher_feedback: string | null;
  grade: number | null;
  points_earned: number;
}

export default function HomeworkDetail() {
  const { homeworkId } = useParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { effectiveUserId, isImpersonating } = useEffectiveUserId();
  const { toast } = useToast();
  
  const [homework, setHomework] = useState<HomeworkDetails | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Submission form state
  const [notes, setNotes] = useState("");
  const [codeContent, setCodeContent] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{
    url: string;
    name: string;
    type: string;
  } | null>(null);
  const [submitType, setSubmitType] = useState<"file" | "code">("file");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && homeworkId && effectiveUserId) {
      fetchHomeworkDetails();
    }
  }, [user, homeworkId, effectiveUserId]);

  const fetchHomeworkDetails = async () => {
    if (!user || !homeworkId || !effectiveUserId) return;
    
    try {
      // Fetch homework with lesson and course details
      const { data: homeworkData, error: homeworkError } = await supabase
        .from("homework")
        .select(`
          *,
          lessons!inner (
            id,
            title,
            lesson_number,
            courses!inner (
              id,
              title,
              emoji,
              slug
            )
          )
        `)
        .eq("id", homeworkId)
        .single();

      if (homeworkError) throw homeworkError;

      const lesson = homeworkData.lessons as any;
      const course = lesson.courses;

      setHomework({
        id: homeworkData.id,
        title: homeworkData.title,
        description: homeworkData.description,
        instructions: homeworkData.instructions,
        points_reward: homeworkData.points_reward,
        due_date: homeworkData.due_date,
        attachments: Array.isArray(homeworkData.attachments) 
          ? (homeworkData.attachments as unknown as Attachment[]) 
          : [],
        lesson: {
          id: lesson.id,
          title: lesson.title,
          lesson_number: lesson.lesson_number,
          course: {
            id: course.id,
            title: course.title,
            emoji: course.emoji,
            slug: course.slug,
          },
        },
      });

      // Fetch existing submission using effective user ID (for impersonation)
      const { data: submissionData } = await supabase
        .from("homework_submissions")
        .select("*")
        .eq("homework_id", homeworkId)
        .eq("student_id", effectiveUserId)
        .maybeSingle();

      if (submissionData) {
        setSubmission(submissionData);
        setNotes(submissionData.notes || "");
      }
    } catch (error) {
      console.error("Error fetching homework:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile caricare i dettagli del compito",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !homework || !effectiveUserId) return;

    // Validate submission
    if (submitType === "file" && !uploadedFile) {
      toast({
        variant: "destructive",
        title: "File richiesto",
        description: "Carica un file prima di inviare",
      });
      return;
    }

    if (submitType === "code" && !codeContent.trim()) {
      toast({
        variant: "destructive",
        title: "Codice richiesto",
        description: "Inserisci il codice prima di inviare",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Use effectiveUserId for student_id when submitting
      const submissionData: any = {
        homework_id: homework.id,
        student_id: effectiveUserId,
        status: "pending",
        notes: notes || null,
      };

      if (submitType === "file" && uploadedFile) {
        submissionData.file_url = uploadedFile.url;
        submissionData.file_name = uploadedFile.name;
        submissionData.file_type = uploadedFile.type;
      } else if (submitType === "code") {
        // Store code as a note with special prefix
        submissionData.notes = `[CODE]\n${codeContent}`;
        submissionData.file_type = "text/code";
      }

      if (submission) {
        // Update existing submission
        const { error } = await supabase
          .from("homework_submissions")
          .update(submissionData)
          .eq("id", submission.id);

        if (error) throw error;
      } else {
        // Create new submission
        const { error } = await supabase
          .from("homework_submissions")
          .insert(submissionData);

        if (error) throw error;
      }

      toast({
        title: "Compito inviato!",
        description: "Il tuo lavoro è stato inviato con successo",
      });

      // Refresh data
      fetchHomeworkDetails();
    } catch (error: any) {
      console.error("Error submitting homework:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile inviare il compito",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    if (!submission) {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
          <Clock className="w-3 h-3 mr-1" />
          Da fare
        </Badge>
      );
    }
    
    switch (submission.status) {
      case "approved":
        return (
          <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Approvato
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">
            <Clock className="w-3 h-3 mr-1" />
            In revisione
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
            <AlertCircle className="w-3 h-3 mr-1" />
            Da rivedere
          </Badge>
        );
      default:
        return null;
    }
  };

  const getDeadlineBadge = () => {
    if (!homework?.due_date || submission) return null;
    
    const now = new Date();
    const dueDate = new Date(homework.due_date);
    const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursUntilDue < 0) {
      return (
        <Badge variant="destructive" className="animate-pulse">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Scaduto
        </Badge>
      );
    }
    
    if (hoursUntilDue <= 24) {
      return (
        <Badge className="bg-red-500 text-white">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Scade oggi!
        </Badge>
      );
    }
    
    if (hoursUntilDue <= 48) {
      return (
        <Badge className="bg-orange-500 text-white">
          <Calendar className="w-3 h-3 mr-1" />
          Scade domani
        </Badge>
      );
    }
    
    return null;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!homework) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8">
          <div className="container max-w-4xl text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Compito non trovato</h1>
            <Button onClick={() => navigate("/area-riservata")}>
              Torna alla dashboard
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8">
        <div className="container max-w-4xl space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/area-riservata/corso/${homework.lesson.course.id}`)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <span>{homework.lesson.course.emoji}</span>
                <Link 
                  to={`/area-riservata/corso/${homework.lesson.course.id}`}
                  className="hover:text-primary transition-colors"
                >
                  {homework.lesson.course.title}
                </Link>
                <span>·</span>
                <span>Lezione {homework.lesson.lesson_number}</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground">{homework.title}</h1>
            </div>
          </div>

          {/* Status and deadline badges */}
          <div className="flex flex-wrap items-center gap-3">
            {getStatusBadge()}
            {getDeadlineBadge()}
            <Badge variant="secondary" className="gap-1">
              <Trophy className="w-3 h-3" />
              {homework.points_reward} punti
            </Badge>
            {homework.due_date && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Scadenza: {formatDate(homework.due_date)}
              </span>
            )}
          </div>

          {/* Instructions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Istruzioni
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {homework.description && (
                <p className="text-muted-foreground">{homework.description}</p>
              )}
              {homework.instructions && (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div 
                    className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: homework.instructions }}
                  />
                </div>
              )}
              {!homework.description && !homework.instructions && (
                <p className="text-muted-foreground italic">Nessuna istruzione specifica</p>
              )}
            </CardContent>
          </Card>

          {/* Attachments Card */}
          {homework.attachments && homework.attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Paperclip className="w-5 h-5 text-primary" />
                  Materiali allegati
                </CardTitle>
                <CardDescription>
                  Scarica i file di riferimento per completare il compito
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {homework.attachments.map((att, idx) => (
                    <a
                      key={idx}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Download className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{att.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(att.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submission Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" />
                {submission ? "La tua consegna" : "Consegna il compito"}
              </CardTitle>
              {submission && (
                <CardDescription>
                  Inviato il {formatDate(submission.submitted_at)}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Teacher feedback if exists */}
              {submission?.teacher_feedback && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                    💬 Feedback dell'insegnante
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {submission.teacher_feedback}
                  </p>
                  {submission.grade && (
                    <p className="mt-2 text-sm font-medium">
                      Voto: {submission.grade}/10 · Punti guadagnati: {submission.points_earned}
                    </p>
                  )}
                </div>
              )}

              {/* Submission form - only if not approved */}
              {submission?.status !== "approved" && (
                <>
                  <Tabs 
                    value={submitType} 
                    onValueChange={(v) => setSubmitType(v as "file" | "code")}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="file" className="gap-2">
                        <Paperclip className="w-4 h-4" />
                        Carica file
                      </TabsTrigger>
                      <TabsTrigger value="code" className="gap-2">
                        <Code className="w-4 h-4" />
                        Scrivi codice
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="file" className="mt-4 space-y-4">
                      <FileUpload
                        onFileUploaded={(url, name, type) => 
                          setUploadedFile({ url, name, type })
                        }
                        existingFile={uploadedFile}
                        onRemoveFile={() => setUploadedFile(null)}
                      />
                    </TabsContent>

                    <TabsContent value="code" className="mt-4 space-y-4">
                      <Textarea
                        placeholder="Incolla qui il tuo codice..."
                        value={codeContent}
                        onChange={(e) => setCodeContent(e.target.value)}
                        className="min-h-[200px] font-mono text-sm"
                      />
                    </TabsContent>
                  </Tabs>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Note aggiuntive (opzionale)
                    </label>
                    <Textarea
                      placeholder="Aggiungi commenti o spiegazioni sul tuo lavoro..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full"
                    size="lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Invio in corso...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {submission ? "Aggiorna consegna" : "Invia compito"}
                      </>
                    )}
                  </Button>
                </>
              )}

              {/* Approved message */}
              {submission?.status === "approved" && (
                <div className="text-center py-4">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground">Compito approvato!</h3>
                  <p className="text-sm text-muted-foreground">
                    Hai guadagnato {submission.points_earned} punti
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
