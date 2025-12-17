import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Processing chat request with', messages.length, 'messages');

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

    return new Response(response.body, {
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
