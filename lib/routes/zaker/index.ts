import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseRelativeDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/:type/:id?',
    radar: [
        {
            source: ['myzaker.com/:type/:id'],
            target: '/:type/:id',
        },
    ],
    name: 'Unknown',
    maintainers: ['LogicJake', 'kt286', 'AlexdanerZe', 'TonyRL'],
    handler,
};

async function handler(ctx) {
    const type = ctx.req.param('type') ?? 'channel';
    const id = ctx.req.param('id') ?? 1;
    const rootUrl = 'http://www.myzaker.com';
    const link = type === 'focusread' ? `${rootUrl}/?pos=selected_article` : `${rootUrl}/${type}/${id}`;

    const response = await got({
        url: link,
        headers: {
            Referer: rootUrl,
        },
    });
    const $ = load(response.data);
    const feedTitle = $('head title').text();

    let items = $('div.content-block')
        .slice(0, 10)
        .map((_, item) => {
            item = $(item);
            return {
                title: item.find('.article-title').text(),
                link: 'http:' + item.find('.article-wrap > a').attr('href').replace('http://', ''),
            };
        })
        .get();

    items = await Promise.all(
        items.map((item) =>
            cache.tryGet(item.link, async () => {
                const response = await got({
                    url: item.link,
                    headers: {
                        Referer: link,
                    },
                });

                const $ = load(response.data);

                item.description = $('div.article_content div').html() ?? '原文已被删除';
                item.author = $('a.article-auther.line').text();
                item.category = $('.lebel-list')
                    .find('a')
                    .toArray()
                    .map((item) => $(item).text());
                const date = $('span.time').text() ?? undefined;
                if (date) {
                    item.pubDate = timezone(parseRelativeDate(date), +8);
                }

                return item;
            })
        )
    );

    return {
        title: type === 'focusread' ? 'ZAKER 精读新闻' : feedTitle,
        link,
        item: items.filter((t) => t.description !== '原文已被删除'),
    };
}
