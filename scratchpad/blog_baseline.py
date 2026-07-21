#!/usr/bin/env python3
"""Compute baseline technical audit metrics for published blog posts.

Reads scratchpad/blog_posts.json and produces:
- scratchpad/blog_stats.json (per-post metrics)
- scratchpad/blog_stats_summary.json (aggregate)
"""
import json, re, os
from collections import defaultdict

VALID_COURSE_ROUTES = {
    "/corsi/roblox", "/corsi/roblox-avanzato", "/corsi/web-development",
    "/corsi/python-base", "/corsi/python-ai", "/corsi",
}
STATIC_INTERNAL = {
    "/prenota", "/faq", "/glossario", "/blog", "/chi-siamo", "/contatti", "/",
}
# Legacy slugs that redirect (still count as valid to avoid false positives)
LEGACY_REDIRECTS = {"/corsi/sviluppo-giochi-con-roblox", "/corsi/python-avanzato"}

REGIONAL_PATTERNS = re.compile(
    r"\b(Veneto|Verona|Vicenza|Padova|Venezia|Treviso|Belluno|Rovigo)\b", re.I
)
DISAMBIG_PATTERNS = re.compile(
    r"(non\s+confondere|studio\s+polacco|Techland\s+Italia\s+è\s+la\s+scuola)", re.I
)
GAME_TOPICS = re.compile(r"\b(roblox|minecraft|videogioch|game\s*dev|videogame)\b", re.I)

AEO_HEADER = re.compile(r"^##\s+Risposta\s+breve", re.I | re.M)
FAQ_HEADER = re.compile(r"^##\s+Domande\s+frequenti|^##\s+FAQ", re.I | re.M)

LINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^\s)]+|/[^\s)]*)\)")

def word_count(text: str) -> int:
    return len(re.findall(r"\S+", text or ""))

posts = json.load(open("scratchpad/blog_posts.json"))
by_slug = {p["slug"]: p for p in posts}

# Build inbound map first
inbound = defaultdict(set)
for p in posts:
    for _, url in LINK_RE.findall(p["content"] or ""):
        m = re.match(r"^/blog/([a-z0-9\-]+)/?$", url)
        if m and m.group(1) != p["slug"] and m.group(1) in by_slug:
            inbound[m.group(1)].add(p["slug"])

per_post = []
for p in posts:
    content = p["content"] or ""
    title = p["title"] or ""
    excerpt = p["excerpt"] or ""
    slug = p["slug"]
    words = word_count(content)

    links = LINK_RE.findall(content)
    internal_links = []
    external_links = []
    course_links = []
    blog_links = []
    ghost_links = []
    for _text, url in links:
        if url.startswith("/"):
            internal_links.append(url)
            path = url.split("#")[0].split("?")[0].rstrip("/")
            if path == "":
                path = "/"
            if path.startswith("/images/") or path.startswith("/assets/") or "." in path.rsplit("/",1)[-1]:
                pass  # static asset, not a route
            elif path.startswith("/corsi/"):
                if path in VALID_COURSE_ROUTES or path in LEGACY_REDIRECTS:
                    course_links.append(url)
                else:
                    ghost_links.append(url)
            elif path.startswith("/blog/"):
                target_slug = path[len("/blog/"):]
                if target_slug in by_slug:
                    blog_links.append(url)
                else:
                    ghost_links.append(url)
            elif path in STATIC_INTERNAL or path == "/corsi":
                pass  # ok
            elif path.startswith("/lp/"):
                pass  # landing page
            else:
                ghost_links.append(url)
        else:
            external_links.append(url)

    is_game_topic = bool(GAME_TOPICS.search(title + " " + content))
    has_disambig = bool(DISAMBIG_PATTERNS.search(content))
    has_regional = bool(REGIONAL_PATTERNS.search(content))
    has_aeo = bool(AEO_HEADER.search(content))
    has_faq = bool(FAQ_HEADER.search(content))
    title_len = len(title)
    excerpt_len = len(excerpt)

    # H1 in body (forbidden per §8.2)
    has_body_h1 = bool(re.search(r"^#\s+[^#]", content, re.M))

    findings = []
    if len(inbound[slug]) == 0: findings.append("T1_orphan")
    if len(course_links) == 0: findings.append("T2_no_course_link")
    if ghost_links: findings.append("T3_ghost_links")
    if words < 600: findings.append("T4_thin")
    if title_len > 60: findings.append("T5_title_long")
    if not (120 <= excerpt_len <= 160): findings.append("T5_excerpt_range")
    if not has_aeo: findings.append("T6_no_aeo")
    if not has_faq: findings.append("T6_no_faq")
    if is_game_topic and not has_disambig: findings.append("T7_no_disambig")
    if has_body_h1: findings.append("MD_body_h1")

    per_post.append({
        "slug": slug,
        "title": title,
        "title_len": title_len,
        "excerpt_len": excerpt_len,
        "words": words,
        "category": p["category"],
        "inbound_count": len(inbound[slug]),
        "internal_links": len(internal_links),
        "course_links": len(course_links),
        "blog_links": len(blog_links),
        "external_links": len(external_links),
        "ghost_links": ghost_links,
        "is_game_topic": is_game_topic,
        "has_disambig": has_disambig,
        "has_regional": has_regional,
        "has_aeo": has_aeo,
        "has_faq": has_faq,
        "has_body_h1": has_body_h1,
        "findings": findings,
        "updated_at": p["updated_at"],
    })

# Aggregate
n = len(per_post)
def pct(k): return f"{k}/{n} ({round(100*k/n)}%)"
agg = {
    "total_published": n,
    "thin_lt600": pct(sum(1 for x in per_post if x["words"] < 600)),
    "orphans": pct(sum(1 for x in per_post if x["inbound_count"] == 0)),
    "zero_internal_out": pct(sum(1 for x in per_post if x["internal_links"] == 0)),
    "no_course_link": pct(sum(1 for x in per_post if x["course_links"] == 0)),
    "ghost_links": pct(sum(1 for x in per_post if x["ghost_links"])),
    "no_aeo": pct(sum(1 for x in per_post if not x["has_aeo"])),
    "no_faq": pct(sum(1 for x in per_post if not x["has_faq"])),
    "title_long": pct(sum(1 for x in per_post if x["title_len"] > 60)),
    "excerpt_out_of_range": pct(sum(1 for x in per_post if not (120 <= x["excerpt_len"] <= 160))),
    "regional_mentions": pct(sum(1 for x in per_post if x["has_regional"])),
    "disambig_when_needed": pct(sum(1 for x in per_post if x["is_game_topic"] and x["has_disambig"])),
    "game_topic_articles": sum(1 for x in per_post if x["is_game_topic"]),
    "body_h1_violations": pct(sum(1 for x in per_post if x["has_body_h1"])),
    "median_words": sorted(x["words"] for x in per_post)[n//2],
    "max_words": max(x["words"] for x in per_post),
    "articles_gte_1000": sum(1 for x in per_post if x["words"] >= 1000),
}

os.makedirs("scratchpad", exist_ok=True)
json.dump(per_post, open("scratchpad/blog_stats.json", "w"), indent=2, ensure_ascii=False)
json.dump(agg, open("scratchpad/blog_stats_summary.json", "w"), indent=2, ensure_ascii=False)
print(json.dumps(agg, indent=2, ensure_ascii=False))

# Print samples of ghost links to understand retarget scope
from collections import Counter
ghosts = Counter()
for p in per_post:
    for g in p["ghost_links"]:
        ghosts[g.split("#")[0].split("?")[0].rstrip("/")] += 1
print("\nTop ghost link targets:")
for g, c in ghosts.most_common(20):
    print(f"  {c:3d}  {g}")
