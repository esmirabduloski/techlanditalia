import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = claimsData.claims.sub;
    const userEmail = claimsData.claims.email || 'unknown';

    // Get request body
    const { title, description, priority, pageUrl, userAgent } = await req.json();

    if (!title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get Jira config from secrets
    const jiraEmail = Deno.env.get('JIRA_EMAIL');
    const jiraApiToken = Deno.env.get('JIRA_API_TOKEN');
    const jiraSiteUrl = Deno.env.get('JIRA_SITE_URL');
    const jiraProjectKey = Deno.env.get('JIRA_PROJECT_KEY');

    if (!jiraEmail || !jiraApiToken || !jiraSiteUrl || !jiraProjectKey) {
      console.error('Missing Jira configuration secrets');
      return new Response(JSON.stringify({ error: 'Jira not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Map priority
    const priorityMap: Record<string, string> = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
    };

    // Build Jira issue payload (ADF format for description)
    const descriptionContent: any[] = [];
    
    if (description) {
      descriptionContent.push({
        type: 'paragraph',
        content: [{ type: 'text', text: description }],
      });
    }

    descriptionContent.push({
      type: 'paragraph',
      content: [
        { type: 'text', text: '---', marks: [{ type: 'strong' }] },
      ],
    });

    descriptionContent.push({
      type: 'paragraph',
      content: [
        { type: 'text', text: `Segnalato da: ${userEmail}\nPagina: ${pageUrl || 'N/A'}\nUser Agent: ${userAgent || 'N/A'}` },
      ],
    });

    const issuePayload = {
      fields: {
        project: { key: jiraProjectKey },
        summary: title,
        description: {
          type: 'doc',
          version: 1,
          content: descriptionContent,
        },
        issuetype: { name: 'Bug' },
        priority: { name: priorityMap[priority] || 'Medium' },
      },
    };

    // Call Jira API
    const basicAuth = btoa(`${jiraEmail}:${jiraApiToken}`);
    const jiraResponse = await fetch(`${jiraSiteUrl}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(issuePayload),
    });

    const jiraData = await jiraResponse.json();

    if (!jiraResponse.ok) {
      console.error('Jira API error:', JSON.stringify(jiraData));
      return new Response(JSON.stringify({ error: 'Failed to create Jira ticket', details: jiraData }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('Jira ticket created:', jiraData.key);

    return new Response(JSON.stringify({ success: true, ticketKey: jiraData.key }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating Jira ticket:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
