import { createContentLoader } from "vitepress";

interface Thought {
  title: string;
  date: string;
  summary: string;
  tags: string[];
  telegramUrl: string;
  url: string;
}

declare const data: Thought[];
export { data };

export default createContentLoader("thoughts/**/*.md", {
  excerpt: true,
  transform(raw): Thought[] {
    return raw
      .filter((page) => page.frontmatter.telegram_message_id)
      .map((page) => ({
        title: page.frontmatter.title,
        date: page.frontmatter.date,
        summary: page.excerpt ?? "",
        tags: page.frontmatter.tags ?? [],
        telegramUrl: page.frontmatter.telegram_url,
        url: page.url
      }))
      .sort((left, right) => right.date.localeCompare(left.date));
  }
});
