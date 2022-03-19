import {script} from '@digshare/script';
import * as Cheerio from 'cheerio';
import fetch from 'node-fetch';

const PROJECT_DEDUPLICATE_LIMIT = 1000;
const WEEKLY_STARS_THRESHOLD = 100;

const GITHUB_BASE_URL = 'https://github.vilicvane.workers.dev';

export interface Storage {
  projects: string[];
}

export default script<undefined, Storage>(async (_payload, {storage}) => {
  let projectSet = new Set(storage.getItem('projects'));

  let html = await fetch(
    `${GITHUB_BASE_URL}/trending?since=weekly&spoken_language_code=zh`,
  ).then(response => response.text());

  let $ = Cheerio.load(html);

  let projects = $('.Box article.Box-row')
    .toArray()
    .map(article => {
      let href = $('h1 > a', article).attr('href')!;

      let name = href.replace(/^\//, '');

      let description = $('h1 + p', article).text().trim();

      let bottom = $('h1 + p + div', article);

      let language =
        $('> span:first-child', bottom).text().trim() || '未知语言';
      let stars = Number(
        $('> a:first-of-type', bottom).text().replace(/[^\d]/g, ''),
      );
      let weeklyStars = Number(
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

  let tags = Array.from(new Set(projects.map(project => project.language)));

  storage.setItem(
    'projects',
    [...projectSet, ...projects.map(project => project.name)].slice(
      -PROJECT_DEDUPLICATE_LIMIT,
    ),
  );

  return {
    content: `\
又发现了 ${
      projects.length
    } 个当周 star 数超过 ${WEEKLY_STARS_THRESHOLD} 的中文项目：

${projects
  .map(
    project =>
      `📦 ${project.name}\n${project.language} ${project.stars}🌟+${project.weeklyStars}\n${project.description}`,
  )
  .join('\n\n')}`,
    links: projects.map(project => {
      return {
        url: `https://github.com/${project.name}`,
        description: `${project.name} (${project.language})`,
      };
    }),
    tags,
  };
});
