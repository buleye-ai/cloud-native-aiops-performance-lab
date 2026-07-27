import { readFile } from "node:fs/promises";
import { listMarkdownFiles, parseArticle, projectRoot } from "./lib.mjs";

const files = await listMarkdownFiles("docs/performance-engineering");

for (const file of files) {
  const article = parseArticle(await readFile(file, "utf8"), file);
  console.log(`${article.relativePath}\t${article.title}`);
}

console.log(`\n共 ${files.length} 篇文章，项目目录：${projectRoot}`);

