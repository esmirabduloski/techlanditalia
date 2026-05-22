import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JiraErrorResponse = {
  errorMessages?: string[];
  errors?: Record<string, string>;
};

type JiraProject = {
  id: string;
  key: string;
  name: string;
};

type JiraIssueType = {
  id: string;
  name: string;
  subtask?: boolean;
};

type ServiceDesk = {
  id: string;
  projectKey: string;
  projectName?: string;
};

type ServiceDeskRequestType = {
  id: string;
  name: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const normalizeProjectKey = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const ticketPattern = trimmed.match(/^([A-Za-z][A-Za-z0-9_]+)-\d+$/);
  if (ticketPattern?.[1]) return ticketPattern[1].toUpperCase();

  return trimmed.toUpperCase();
};

const buildProjectCandidates = (rawValue: string) => {
  const trimmed = rawValue.trim();
  const normalized = normalizeProjectKey(trimmed);
  const withoutSuffix = trimmed.includes("-") ? trimmed.split("-")[0].trim().toUpperCase() : "";
  const isNumericProjectId = /^\d+$/.test(trimmed) ? trimmed : "";

  return Array.from(new Set([trimmed, normalized, withoutSuffix, isNumericProjectId].filter(Boolean)));
};

const sanitizeSiteUrl = (url: string) => url.trim().replace(/\/+$/, "");

const parseJsonSafely = async (response: Response): Promise<any> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const pickIssueType = (types: JiraIssueType[]) => {
  if (!types.length) return null;

  const nonSubtasks = types.filter((t) => !t.subtask);
  const pool = nonSubtasks.length ? nonSubtasks : types;

  const byName = (name: string) => pool.find((t) => t.name.toLowerCase() === name.toLowerCase());
  return byName("Bug") ?? byName("Task") ?? pool[0] ?? null;
};

const pickRequestType = (types: ServiceDeskRequestType[]) => {
  if (!types.length) return null;
  const priorities = ["bug", "incident", "support", "help", "issue"];

  for (const keyword of priorities) {
    const match = types.find((t) => t.name.toLowerCase().includes(keyword));
    if (match) return match;
  }

  return types[0];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    const userEmail = (claimsData.claims.email as string | undefined) ?? "unknown";

    let body: {
      title?: string;
      description?: string;
      priority?: string;
      pageUrl?: string;
      userAgent?: string;
    };

    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: jsonHeaders });
    }

    const title = body.title?.trim();
    const description = body.description?.trim();
    const priority = body.priority?.trim() ?? "medium";
    const pageUrl = body.pageUrl?.trim();
    const userAgent = body.userAgent?.trim();

    if (!title) {
      return new Response(JSON.stringify({ error: "Title is required" }), { status: 400, headers: jsonHeaders });
    }

    const jiraEmail = Deno.env.get("JIRA_EMAIL")?.trim();
    const jiraApiToken = Deno.env.get("JIRA_API_TOKEN")?.trim();
    const jiraSiteUrlRaw = Deno.env.get("JIRA_SITE_URL")?.trim();
    const jiraProjectKeyRaw = Deno.env.get("JIRA_PROJECT_KEY")?.trim();

    if (!jiraEmail || !jiraApiToken || !jiraSiteUrlRaw || !jiraProjectKeyRaw) {
      console.error("Missing Jira configuration secrets");
      return new Response(JSON.stringify({ error: "Jira not configured" }), { status: 500, headers: jsonHeaders });
    }

    const jiraSiteUrl = sanitizeSiteUrl(jiraSiteUrlRaw);
    const projectCandidates = buildProjectCandidates(jiraProjectKeyRaw);
    const normalizedConfiguredProjectKey = normalizeProjectKey(jiraProjectKeyRaw);

    const priorityMap: Record<string, string> = {
      low: "Low",
      medium: "Medium",
      high: "High",
    };

    const detailsText = `Segnalato da: ${userEmail}\nPagina: ${pageUrl || "N/A"}\nUser Agent: ${userAgent || "N/A"}`;

    const descriptionContent: Array<Record<string, unknown>> = [];

    if (description) {
      descriptionContent.push({
        type: "paragraph",
        content: [{ type: "text", text: description }],
      });
    }

    descriptionContent.push({
      type: "paragraph",
      content: [{ type: "text", text: "---", marks: [{ type: "strong" }] }],
    });

    descriptionContent.push({
      type: "paragraph",
      content: [{ type: "text", text: detailsText }],
    });

    const basicAuth = btoa(`${jiraEmail}:${jiraApiToken}`);

    let lastJiraError: JiraErrorResponse | null = null;
    const triedProjects: string[] = [];
    let availableIssueTypesForProject: JiraIssueType[] = [];
    let serviceDeskDiagnostics: Record<string, unknown> | null = null;

    const callJira = async (path: string, method: string, body?: unknown, extraHeaders?: Record<string, string>) => {
      const response = await fetch(`${jiraSiteUrl}${path}`, {
        method,
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(extraHeaders ?? {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const data = await parseJsonSafely(response);
      return { ok: response.ok, status: response.status, data };
    };

    const createIssue = async (projectValue: string, issueType: { id?: string; name?: string }) => {
      const projectField = /^\d+$/.test(projectValue) ? { id: projectValue } : { key: projectValue };
      const issuetype = issueType.id ? { id: issueType.id } : { name: issueType.name ?? "Bug" };

      const issuePayload = {
        fields: {
          project: projectField,
          summary: title,
          description: {
            type: "doc",
            version: 1,
            content: descriptionContent,
          },
          issuetype,
          priority: { name: priorityMap[priority] || "Medium" },
        },
      };

      const result = await callJira("/rest/api/3/issue", "POST", issuePayload);
      if (!result.ok) {
        lastJiraError = result.data as JiraErrorResponse;
        return null;
      }

      return result.data as { key?: string };
    };

    const fetchIssueTypes = async (projectValue: string): Promise<JiraIssueType[]> => {
      const result = await callJira(`/rest/api/3/issue/createmeta/${encodeURIComponent(projectValue)}/issuetypes`, "GET");
      if (!result.ok || !Array.isArray(result.data?.values)) {
        return [];
      }

      return result.data.values
        .map((item: any) => ({
          id: String(item.id ?? ""),
          name: String(item.name ?? ""),
          subtask: Boolean(item.subtask),
        }))
        .filter((item: JiraIssueType) => item.id && item.name);
    };

    const tryProject = async (projectValue: string) => {
      const bugResult = await createIssue(projectValue, { name: "Bug" });
      if (bugResult?.key) return bugResult;

      if (!lastJiraError?.errors?.issuetype) {
        return null;
      }

      availableIssueTypesForProject = await fetchIssueTypes(projectValue);
      const fallbackType = pickIssueType(availableIssueTypesForProject);
      if (!fallbackType) return null;

      return await createIssue(projectValue, { id: fallbackType.id });
    };

    const tryCreateViaServiceDesk = async (projectKey: string) => {
      const desksResult = await callJira("/rest/servicedeskapi/servicedesk", "GET");
      if (!desksResult.ok || !Array.isArray(desksResult.data?.values)) {
        serviceDeskDiagnostics = {
          step: "list_servicedesks_failed",
          status: desksResult.status,
          data: desksResult.data,
        };
        return null;
      }

      const desks: ServiceDesk[] = desksResult.data.values
        .map((desk: any) => ({
          id: String(desk.id ?? ""),
          projectKey: String(desk.projectKey ?? "").toUpperCase(),
          projectName: desk.projectName ? String(desk.projectName) : undefined,
        }))
        .filter((desk: ServiceDesk) => desk.id && desk.projectKey);

      const desk = desks.find((d) => d.projectKey === projectKey.toUpperCase());
      if (!desk) {
        serviceDeskDiagnostics = {
          step: "servicedesk_not_found_for_project",
          projectKey,
          availableServiceDeskProjectKeys: desks.map((d) => d.projectKey),
        };
        return null;
      }

      const requestTypesResult = await callJira(`/rest/servicedeskapi/servicedesk/${desk.id}/requesttype`, "GET");
      if (!requestTypesResult.ok || !Array.isArray(requestTypesResult.data?.values)) {
        serviceDeskDiagnostics = {
          step: "list_request_types_failed",
          serviceDeskId: desk.id,
          status: requestTypesResult.status,
          data: requestTypesResult.data,
        };
        return null;
      }

      const requestTypes: ServiceDeskRequestType[] = requestTypesResult.data.values
        .map((type: any) => ({ id: String(type.id ?? ""), name: String(type.name ?? "") }))
        .filter((type: ServiceDeskRequestType) => type.id && type.name);

      const requestType = pickRequestType(requestTypes);
      if (!requestType) {
        serviceDeskDiagnostics = {
          step: "no_request_type_available",
          serviceDeskId: desk.id,
        };
        return null;
      }

      const requestPayload = {
        serviceDeskId: desk.id,
        requestTypeId: requestType.id,
        requestFieldValues: {
          summary: title,
          description: description ? `${description}\n\n---\n${detailsText}` : detailsText,
        },
      };

      const createRequestResult = await callJira("/rest/servicedeskapi/request", "POST", requestPayload);
      if (!createRequestResult.ok) {
        serviceDeskDiagnostics = {
          step: "create_servicedesk_request_failed",
          serviceDeskId: desk.id,
          requestTypeId: requestType.id,
          status: createRequestResult.status,
          data: createRequestResult.data,
        };
        return null;
      }

      const issueKey =
        createRequestResult.data?.issueKey ??
        createRequestResult.data?.issue?.key ??
        createRequestResult.data?.key ??
        null;

      if (!issueKey) {
        serviceDeskDiagnostics = {
          step: "request_created_without_issue_key",
          data: createRequestResult.data,
        };
        return null;
      }

      return { key: issueKey };
    };

    for (const candidate of projectCandidates) {
      triedProjects.push(candidate);
      const jiraData = await tryProject(candidate);

      if (jiraData?.key) {
        console.log("Jira ticket created:", jiraData.key);
        return new Response(JSON.stringify({ success: true, ticketKey: jiraData.key }), {
          status: 200,
          headers: jsonHeaders,
        });
      }

      const projectError = lastJiraError?.errors?.project;
      if (!projectError) {
        break;
      }
    }

    const projectsResult = await callJira("/rest/api/3/project/search?maxResults=50", "GET");
    const availableProjects: JiraProject[] = projectsResult.ok && Array.isArray(projectsResult.data?.values)
      ? projectsResult.data.values
          .map((p: any) => ({ id: String(p.id ?? ""), key: String(p.key ?? ""), name: String(p.name ?? "") }))
          .filter((p: JiraProject) => p.key)
      : [];

    const resolvedProjectKey =
      availableProjects.find((p) => p.key.toUpperCase() === normalizedConfiguredProjectKey)?.key ??
      availableProjects.find((p) => p.key.toUpperCase().startsWith(normalizedConfiguredProjectKey))?.key ??
      normalizedConfiguredProjectKey;

    if (lastJiraError?.errors?.issuetype || lastJiraError?.errors?.project) {
      const serviceDeskResult = await tryCreateViaServiceDesk(resolvedProjectKey);
      if (serviceDeskResult?.key) {
        console.log("Jira Service Desk request created:", serviceDeskResult.key);
        return new Response(JSON.stringify({ success: true, ticketKey: serviceDeskResult.key }), {
          status: 200,
          headers: jsonHeaders,
        });
      }
    }

    console.error("Jira API error:", JSON.stringify({
      jiraError: lastJiraError,
      configuredProjectKey: jiraProjectKeyRaw,
      triedProjects,
      availableProjectKeys: availableProjects.slice(0, 20).map((p) => p.key),
      availableIssueTypes: availableIssueTypesForProject.map((t) => ({ id: t.id, name: t.name })),
      serviceDeskDiagnostics,
    }));

    return new Response(
      JSON.stringify({ error: "Failed to create Jira ticket" }),
      { status: 500, headers: jsonHeaders },
    );
  } catch (error) {
    console.error("Error creating Jira ticket:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: jsonHeaders });
  }
});
