#!/usr/bin/env python3
"""Fase 1 zero-risk fixes generator.

Produces:
- scratchpad/blog_fase1.sql : snapshot + UPDATE per slug
- BLOG_FIX_LOG.md : human log of changes
- content-backups/blog/fase1/*.json : before-snapshots per article
"""
import json, re, os
from datetime import datetime

posts = json.load(open("scratchpad/blog_posts.json"))
by_slug = {p["slug"]: p for p in posts}

# --- Retarget map for ghost course links ---
RETARGET = {
    "/corsi/scratch": "/corsi",
    "/corsi/minecraft-education": "/corsi/roblox",
    "/corsi/abc-creativita-digitale": "/corsi",
    "/corsi/python": "/corsi/python-base",
}
# Match /corsi/<slug> allowing trailing / or fragment/query
GHOST_RE = re.compile(r"\((/corsi/(?:scratch|minecraft-education|abc-creativita-digitale|python))(/?)([)#?])")

def retarget_content(content: str) -> tuple[str, int]:
    """Replace ghost course URLs. Returns (new, count)."""
    count = 0
    def sub(m):
        nonlocal count
        target = RETARGET[m.group(1)]
        count += 1
        return f"({target}{m.group(3)}"
    new = GHOST_RE.sub(sub, content)
    return new, count

def fix_body_h1(content: str) -> tuple[str, bool]:
    # Only promote leading `# X` (not `## X`) at line start
    new = re.sub(r"(?m)^#\s+([^#].*)$", r"## \1", content)
    return new, (new != content)

def trim_excerpt(excerpt: str) -> tuple[str, bool]:
    if len(excerpt) <= 160:
        return excerpt, False
    # cut at word boundary <= 158, add period if missing
    cut = excerpt[:158].rsplit(" ", 1)[0].rstrip(",;:. ")
    if not cut.endswith((".", "!", "?")):
        cut += "."
    return cut, True

def shorten_title(title: str) -> tuple[str, bool]:
    if len(title) <= 60:
        return title, False
    # Try splitting on delimiters, prefer segment before delimiter if 30..60
    for delim in [": ", " — ", " – ", " | "]:
        if delim in title:
            head = title.split(delim, 1)[0].strip()
            if 30 <= len(head) <= 60:
                return head, True
    # Try dropping trailing parenthetical
    m = re.match(r"^(.*?)\s*\([^)]*\)\s*$", title)
    if m and 30 <= len(m.group(1)) <= 60:
        return m.group(1).strip(), True
    return title, False  # leave for editorial phase

def sql_escape(s: str) -> str:
    return s.replace("'", "''")

os.makedirs("content-backups/blog/fase1", exist_ok=True)
sql_parts = ["-- Fase 1: zero-risk blog fixes", "-- Generated: " + datetime.utcnow().isoformat() + "Z", "BEGIN;", ""]
log_lines = ["# BLOG_FIX_LOG",
             "",
             f"## Fase 1 — {datetime.utcnow().date().isoformat()}",
             "",
             "Zero-risk fixes: ghost link retargeting, body H1 promotion, excerpt trim (>160), title shortening (safe delimiter splits only).",
             "",
             "| Slug | Ghost fixes | H1 fix | Title (before → after) | Excerpt trim | Words |",
             "|---|---:|:---:|---|:---:|---:|"]

changed = []
for p in posts:
    slug = p["slug"]
    orig = {
        "title": p["title"],
        "excerpt": p["excerpt"],
        "content": p["content"],
        "read_time": p["read_time"],
    }
    new_content, ghost_n = retarget_content(p["content"] or "")
    new_content, h1_fixed = fix_body_h1(new_content)
    new_excerpt, excerpt_trimmed = trim_excerpt(p["excerpt"] or "")
    new_title, title_shortened = shorten_title(p["title"] or "")

    any_change = ghost_n > 0 or h1_fixed or excerpt_trimmed or title_shortened
    if not any_change:
        continue

    # backup file
    open(f"content-backups/blog/fase1/{slug}.json", "w").write(
        json.dumps({"before": orig, "after": {
            "title": new_title, "excerpt": new_excerpt, "content": new_content
        }}, indent=2, ensure_ascii=False))

    # snapshot insert
    sql_parts.append(
        f"INSERT INTO content_snapshots (entity_type, entity_id, entity_label, snapshot_label, snapshot_data) "
        f"VALUES ('blog_post', '{p['id']}', '{sql_escape(slug)}', 'pre-fase1-audit', "
        f"'{sql_escape(json.dumps(orig, ensure_ascii=False))}'::jsonb);"
    )
    # update
    sets = [
        f"title = '{sql_escape(new_title)}'",
        f"excerpt = '{sql_escape(new_excerpt)}'",
        f"content = '{sql_escape(new_content)}'",
        "updated_at = now()",
    ]
    sql_parts.append(f"UPDATE blog_posts SET {', '.join(sets)} WHERE slug = '{sql_escape(slug)}' AND published = true;")
    sql_parts.append("")

    words_after = len(re.findall(r"\S+", new_content))
    title_cell = "—" if not title_shortened else f"`{orig['title'][:40]}…` → `{new_title}`"
    log_lines.append(
        f"| {slug} | {ghost_n} | {'✓' if h1_fixed else ''} | {title_cell} | {'✓' if excerpt_trimmed else ''} | {words_after} |"
    )
    changed.append(slug)

sql_parts.append("COMMIT;")
open("scratchpad/blog_fase1.sql", "w").write("\n".join(sql_parts))

log_lines.append("")
log_lines.append(f"**Totale articoli modificati: {len(changed)}/92**")
log_lines.append("")
log_lines.append("### Rimasti per Fase 2/3 (input editoriale)")
log_lines.append("")
log_lines.append("- Title >60 char senza delimiter naturale (7 articoli)")
log_lines.append("- Excerpt <120 char (37 articoli) — richiedono espansione")
log_lines.append("- T1 orfani, T4 thin content, T6 AEO/FAQ, T7 disambiguazione — Fase 2/3")

open("BLOG_FIX_LOG.md", "w").write("\n".join(log_lines))
print(f"Articoli modificati: {len(changed)}")
print(f"SQL scritto in: scratchpad/blog_fase1.sql ({sum(1 for _ in open('scratchpad/blog_fase1.sql'))} righe)")
