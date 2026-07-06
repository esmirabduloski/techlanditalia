/// <reference types="node" />
import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "get_course",
  title: "Get course details",
  description: "Fetch full details for a single TECHLAND course by its slug (e.g. 'python-avanzato').",
  inputSchema: {
    slug: z.string().min(1).describe("Course slug, e.g. 'roblox-avanzato'"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("slug", slug)
      .eq("is_visible", true)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: `No visible course with slug '${slug}'` }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { course: data },
    };
  },
});
