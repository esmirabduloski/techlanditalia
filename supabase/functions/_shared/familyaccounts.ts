/**
 * Creazione degli account di famiglie e insegnanti da parte di un admin,
 * condivisa da admin-create-user (uno alla volta) e admin-import-students
 * (in blocco da CSV).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { randomUnknownPassword } from "./studentpassword.ts";

export interface AccountClients {
  /** Service role */
  admin: SupabaseClient;
  /** Chiave anon con il token dell'admin che chiama: serve dove conta auth.uid() */
  asAdmin: SupabaseClient;
}

export type AdultResult = { ok: true; userId: string } | { ok: false; status: number; error: string };

export type ChildResult =
  | { ok: true; childId: string }
  /** auth: account del figlio non creato; profile: creato e poi annullato */
  | { ok: false; stage: "auth" | "profile"; error: string };

// Il link "Imposta la tua password" deve puntare alla pagina con il form di nuova
// password, non alla homepage. Stessa allowlist usata da send-password-reset-email.
const ALLOWED_HOSTS = new Set([
  "techlanditalia.it",
  "www.techlanditalia.it",
  "techlanditalia.lovable.app",
]);

export function resolveSetupRedirect(req: Request): string {
  const fallback = "https://techlanditalia.it/auth?reset=true";
  const origin = req.headers.get("origin");
  if (!origin) return fallback;
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:" && u.protocol !== "http:") return fallback;
    if (ALLOWED_HOSTS.has(u.hostname) || u.hostname.endsWith(".lovable.app")) {
      return `${u.origin}/auth?reset=true`;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Account di un genitore o di un insegnante con il suo profilo. Se il profilo
 * non si salva l'account viene eliminato.
 */
export async function createAdultAccount(
  { admin, asAdmin }: AccountClients,
  input: { email: string; password: string; fullName: string; role: "parent" | "teacher" },
): Promise<AdultResult> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const { data: authData, error: createError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: input.role,
    },
  });

  if (createError) {
    console.error("Error creating user:", createError);
    let msg = "Impossibile creare l'account";
    if (createError.message.includes("already been registered")) {
      msg = "Questa email è già registrata";
    } else if ((createError as { code?: string }).code === "weak_password" || createError.message.toLowerCase().includes("weak")) {
      msg = "Password troppo debole o già comparsa in fughe di dati. Usa una password diversa (almeno 8 caratteri, con lettere, numeri e un simbolo) o premi 'Genera'.";
    }
    return { ok: false, status: 400, error: msg };
  }

  const userId = authData.user.id;

  // Il trigger su auth.users crea già il profilo con ruolo 'student'. Il cambio di
  // ruolo va fatto con la sessione dell'admin: un vecchio trigger di sicurezza su
  // profiles accettava il cambio ruolo solo se auth.uid() era un admin (con la
  // service role auth.uid() è NULL e l'update veniva respinto).
  const profileFields = { full_name: fullName, email, role: input.role };

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  let profileError: unknown = null;
  if (existingProfile) {
    const { data: updated, error } = await asAdmin
      .from("profiles")
      .update(profileFields)
      .eq("id", userId)
      .select("id");
    profileError = error ?? (updated && updated.length > 0 ? null : { message: "Nessuna riga aggiornata (permessi admin)" });
  } else {
    const { error } = await admin.from("profiles").insert({ id: userId, ...profileFields });
    profileError = error;
  }

  if (profileError) {
    console.error("Error creating/updating parent profile:", profileError);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, status: 500, error: "Impossibile creare il profilo utente" };
  }

  return { ok: true, userId };
}

/** Ruolo 'user' dei genitori, accanto al profilo con role = 'parent'. */
export async function addParentRole(admin: SupabaseClient, userId: string) {
  const { error } = await admin.from("user_roles").insert({ user_id: userId, role: "user" });
  if (error && !error.message.includes("duplicate")) {
    console.error("Error adding user role:", error);
  }
}

/**
 * Account del figlio collegato al genitore, iscritto ai corsi indicati. La
 * password del figlio NON è quella del genitore: nasce casuale e il genitore la
 * imposta dall'area riservata (parent-set-child-password, 0046_student_passwords).
 */
export async function createChildAccount(
  admin: SupabaseClient,
  input: { parentId: string; childName: string; childUsername: string; courseIds: string[] },
): Promise<ChildResult> {
  const childName = input.childName.trim();
  const childUsername = input.childUsername.trim();
  // Email interna mai mostrata: il suffisso evita doppioni negli import veloci
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const childEmail = `${childUsername.toLowerCase().replace(/[^a-z0-9]/g, "")}_${suffix}@student.techland.local`;

  const { data: childAuthData, error: childAuthError } = await admin.auth.admin.createUser({
    email: childEmail,
    password: randomUnknownPassword(),
    email_confirm: true,
    user_metadata: {
      full_name: childName,
      role: "student",
    },
  });

  if (childAuthError) {
    console.error("Error creating child account:", childAuthError);
    return { ok: false, stage: "auth", error: childAuthError.message };
  }

  const childId = childAuthData.user.id;

  // Create/update child profile explicitly instead of relying on auth triggers.
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({
      id: childId,
      full_name: childName,
      email: childEmail,
      role: "student",
      username: childUsername,
      parent_id: input.parentId,
    }, { onConflict: "id" });

  if (profileError) {
    console.error("Error updating child profile:", profileError);
    await admin.auth.admin.deleteUser(childId);
    return { ok: false, stage: "profile", error: profileError.message };
  }

  const { error: pwSettingsError } = await admin
    .from("student_password_settings")
    .upsert({ student_id: childId, own_password: true, set_at: new Date().toISOString() });
  if (pwSettingsError) {
    console.error("Error saving child password settings:", pwSettingsError);
  }

  for (const courseId of input.courseIds) {
    const { error: enrollError } = await admin
      .from("enrollments")
      .insert({ student_id: childId, course_id: courseId, status: "active" });
    if (enrollError) {
      console.error("Error creating enrollment:", enrollError);
    }
  }

  return { ok: true, childId };
}

/**
 * Email di benvenuto con un link monouso per impostare la password (mai la
 * password in chiaro). Va a send-welcome-email con il token dell'admin.
 */
export async function sendWelcomeEmail(
  req: Request,
  { admin, asAdmin }: AccountClients,
  input: { userId: string; email: string; fullName: string; role: "parent" | "teacher"; childName?: string; childUsername?: string },
) {
  try {
    const email = input.email.trim().toLowerCase();
    const welcomeBody: Record<string, string> = {
      email,
      fullName: input.fullName.trim(),
      role: input.role,
      // Collega l'email al profilo nel registro email (sparisce con l'account)
      userId: input.userId,
    };
    if (input.role === "parent" && input.childName && input.childUsername) {
      welcomeBody.childName = input.childName.trim();
      welcomeBody.childUsername = input.childUsername.trim();
    }

    // Generate a one-time recovery link so the user can set their own password.
    // Senza redirectTo il link cadeva sul Site URL (la homepage) e il form di
    // nuova password non veniva mai mostrato.
    try {
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: resolveSetupRedirect(req) },
      });
      const actionLink = linkData?.properties?.action_link;
      if (actionLink) {
        welcomeBody.setupLink = actionLink;
      }
    } catch (linkErr) {
      console.error("Error generating setup link:", linkErr);
    }

    // Client con la chiave anon e il token dell'admin: send-welcome-email autorizza la chiamata
    await asAdmin.functions.invoke("send-welcome-email", { body: welcomeBody });
  } catch (err) {
    console.error("Welcome email error:", err);
  }
}
