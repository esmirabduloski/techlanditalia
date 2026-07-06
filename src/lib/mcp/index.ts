import { defineMcp } from "@lovable.dev/mcp-js";
import listCourses from "./tools/list-courses";
import getCourse from "./tools/get-course";
import listBlogPosts from "./tools/list-blog-posts";
import getBlogPost from "./tools/get-blog-post";

export default defineMcp({
  name: "techland-mcp",
  title: "TECHLAND",
  version: "0.1.0",
  instructions:
    "Read-only access to TECHLAND's public catalog: coding courses for kids/teens (6-18) and the blog. Use `list_courses` to browse the catalog, `get_course` for a course by slug, `list_blog_posts` to browse articles, and `get_blog_post` to read one.",
  tools: [listCourses, getCourse, listBlogPosts, getBlogPost],
});
