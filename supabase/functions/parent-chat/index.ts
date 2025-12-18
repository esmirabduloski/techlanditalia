import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to save messages to DB
async function saveMessage(
  supabase: any,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
) {
  const { error } = await supabase
    .from('chat_messages')
    .insert({ conversation_id: conversationId, role, content });
  if (error) console.error('Error saving message:', error);
}

async function getOrCreateConversation(
  supabase: any,
  sessionId: string
): Promise<string> {
  // Try to find existing conversation
  const { data: existing } = await supabase
    .from('chat_conversations')
    .select('id')
    .eq('session_id', sessionId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  // Create new conversation
  const { data: newConv, error } = await supabase
    .from('chat_conversations')
    .insert({ session_id: sessionId })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }

  return newConv.id;
}

const SYSTEM_PROMPT = `Sei l'assistente virtuale di TECHLAND, una scuola di coding online per bambini e ragazzi dai 6 ai 18 anni. Il tuo compito è aiutare i genitori a trovare informazioni sui nostri corsi e rispondere alle loro domande in modo amichevole e professionale.

INFORMAZIONI SUI CORSI:

📚 CATEGORIE DI CORSI:
- Coding Base: Introduzione alla programmazione con Scratch e blocchi visuali
- Sviluppo Giochi: Creazione di videogiochi con Unity e Godot
- Roblox Studio: Creazione di mondi e giochi su Roblox
- Sviluppo Web: HTML, CSS, JavaScript per creare siti web
- Python & AI: Programmazione Python e introduzione all'intelligenza artificiale (per ragazzi 13-18)

👶 FASCE D'ETÀ:
- 6-8 anni: Coding Base con Scratch Jr, attività ludiche e creative
- 9-12 anni: Scratch avanzato, Roblox Studio, Game Development base
- 13-18 anni: Web Development, Python, AI, Game Development avanzato

📋 LIVELLI:
- Principiante: Per chi inizia da zero
- Intermedio: Per chi ha già basi di programmazione
- Avanzato: Per chi vuole approfondire e creare progetti complessi

💡 CARATTERISTICHE:
- Lezioni online dal vivo con insegnanti esperti
- Classi piccole (max 6 studenti) per attenzione personalizzata
- Registrazioni delle lezioni sempre disponibili
- Ambiente sicuro e controllato
- Report di progresso per i genitori
- Prima lezione di prova GRATUITA

📞 SUPPORTO:
- Assistenza tecnica inclusa
- Tutor disponibili per domande extra
- Comunità di studenti e genitori

LINEE GUIDA:
1. Rispondi SEMPRE in italiano
2. Sii cordiale e rassicurante con i genitori
3. Suggerisci di prenotare una lezione gratuita quando appropriato
4. Se non conosci una risposta specifica (es. prezzi esatti), invita a contattarci o prenotare una consulenza
5. Mantieni risposte concise ma complete
6. Usa emoji occasionalmente per rendere la conversazione più amichevole`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, sessionId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Processing chat request with', messages.length, 'messages');

    // Initialize Supabase client for saving messages
    let conversationId: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let supabase: any = null;

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && sessionId) {
      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      try {
        conversationId = await getOrCreateConversation(supabase, sessionId);
        // Save the latest user message
        const lastUserMessage = messages[messages.length - 1];
        if (lastUserMessage?.role === 'user') {
          await saveMessage(supabase, conversationId, 'user', lastUserMessage.content);
        }
      } catch (dbError) {
        console.error('DB error:', dbError);
      }
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Troppi messaggi, riprova tra poco.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Servizio temporaneamente non disponibile.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'Errore del servizio AI' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // We need to capture the streamed response to save the assistant message
    // Create a transform stream to capture and pass through the response
    const originalBody = response.body;
    if (!originalBody) {
      return new Response(JSON.stringify({ error: 'No response body' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let fullAssistantContent = '';
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        
        // Parse the chunk to extract assistant content
        const text = new TextDecoder().decode(chunk);
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const json = JSON.parse(line.slice(6));
              const content = json.choices?.[0]?.delta?.content;
              if (content) fullAssistantContent += content;
            } catch {
              // Ignore parse errors for partial chunks
            }
          }
        }
      },
      async flush() {
        // Save the complete assistant response
        if (supabase && conversationId && fullAssistantContent) {
          await saveMessage(supabase, conversationId, 'assistant', fullAssistantContent);
          console.log('Saved assistant response to conversation:', conversationId);
        }
      }
    });

    const transformedBody = originalBody.pipeThrough(transformStream);

    return new Response(transformedBody, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('Parent chat error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Errore sconosciuto' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
