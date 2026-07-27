import { createContentLoader } from "vitepress";

interface LearningCard {
  title: string;
  date: string;
  summary: string;
  tags: string[];
  url: string;
}

declare const data: LearningCard[];
export { data };

export default createContentLoader("learning/**/*.md", {
  excerpt: true,
  transform(raw): LearningCard[] {
    return raw
      .filter((page) => page.frontmatter.telegram_candidate_id)
      .map((page) => ({
        title: page.frontmatter.title,
        date: page.frontmatter.date,
        summary: page.excerpt ?? "",
        tags: page.frontmatter.tags ?? [],
        url: page.url
      }))
      .sort((left, right) => right.date.localeCompare(left.date));
  }
});
