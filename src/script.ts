import {script} from '@digshare/script';
import * as Cheerio from 'cheerio';

const PROJECT_DEDUPLICATE_LIMIT = 1000;
const WEEKLY_STARS_THRESHOLD = 100;

const GITHUB_BASE_URL = 'https://github.com';

export interface State {
  projects: string[];
}

export default script<State>(async (state = {projects: []}) => {
  const projectSet = new Set(state.projects);

  const html = await fetch(
    `${GITHUB_BASE_URL}/trending?since=weekly&spoken_language_code=zh`,
  ).then(response => response.text());

  const $ = Cheerio.load(html);

  const projects = $('.Box article.Box-row')
    .toArray()
    .map(article => {
      const href = $('h2 > a', article).attr('href')!;

      const name = href.replace(/^\//, '');

      const description = $('h2 + p', article).text().trim();

      const bottom = $('h2 + p + div', article);

      const language =
        $('> span:first-child', bottom).text().trim() || '未知语言';
      const stars = Number(
        $('> a:first-of-type', bottom).text().replace(/[^\d]/g, ''),
      );
      const weeklyStars = Number(
        $('> :last-child', bottom).text().replace(/[^\d]/g, ''),
      );

      return {
        name,
        language,
        stars,
        weeklyStars,
        description,
      };
    })
    .filter(
      project =>
        project.weeklyStars >= WEEKLY_STARS_THRESHOLD &&
        !projectSet.has(project.name),
    );

  if (projects.length === 0) {
    console.log('暂无新项目～');
    return undefined;
  }

  const tags = Array.from(new Set(projects.map(project => project.language)));

  state.projects = [
    ...projectSet,
    ...projects.map(project => project.name),
  ].slice(-PROJECT_DEDUPLICATE_LIMIT);

  return {
    message: {
      content: `\
又发现了 ${
        projects.length
      } 个当周 star 数超过 ${WEEKLY_STARS_THRESHOLD} 的中文项目：

  ${projects
    .map(
      project =>
        `\
- 📦 [${project.name}](https://github.com/${project.name})
  ${project.stars}**+${project.weeklyStars}**🌟
  ${project.language}
  ${project.description}`,
    )
    .join('\n')}`,
      tags,
    },
    state,
  };
});
