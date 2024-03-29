import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/report/:category',
    categories: ['finance'],
    example: '/eastmoney/report/strategyreport',
    parameters: { category: '研报类型' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['data.eastmoney.com/report/:category'],
        },
    ],
    name: '研究报告',
    maintainers: ['syzq'],
    handler,
    description: `| 策略报告       | 宏观研究    | 券商晨报     | 行业研究 |
  | -------------- | ----------- | ------------ | -------- |
  | strategyreport | macresearch | brokerreport | industry |`,
};

async function handler(ctx) {
    const baseUrl = 'https://data.eastmoney.com';
    const { category = 'strategyreport' } = ctx.req.param();

    const reportType = {
        brokerreport: '券商晨报',
        industry: '行业研报',
        macresearch: '宏观研究',
        strategyreport: '策略报告',
    };
    const linkType = {
        brokerreport: 'zw_brokerreport',
        industry: 'zw_industry',
        macresearch: 'zw_macresearch',
        strategyreport: 'zw_strategy',
    };

    const res = await got(`${baseUrl}/report/${category}`);
    const $ = load(res.data);

    const initData = JSON.parse(
        $('script')
            .text()
            .match(/var initdata(.=?)(.*?);/)[2]
    );

    const list = initData.data.map((item) => ({
        title: `[${item.orgSName}]${item.title}`,
        link: `${baseUrl}/report/${linkType[category]}.jshtml?encodeUrl=${item.encodeUrl}`,
        pubDate: parseDate(item.publishDate),
        author: item.researcher,
    }));

    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(item.link, async () => {
                try {
                    const { data: response } = await got(item.link);
                    const $ = load(response);
                    item.link = $('.pdf-link').attr('href');
                    item.description = $('.ctx-content').text();
                    return item;
                } catch {
                    return item;
                }
            })
        )
    );

    return {
        title: `东方财富网-${reportType[category]}`,
        link: baseUrl,
        item: items,
    };
}
