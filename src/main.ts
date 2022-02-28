import Apify, { RequestOptions } from 'apify';

import { GlobalStore } from 'apify-global-store';

import { MAIN_URL } from './consts';

const { puppeteer } = Apify.utils;

interface Schema {
    requestsNum?: number;
}

Apify.main(async () => {
    const { requestsNum = 50 } = (await Apify.getInput()) as Schema;

    const store = new GlobalStore('COOKIE-STORE');
    await store.initialize({ cookies: [] });

    const requests: RequestOptions[] = [];

    for (const x of Array(requestsNum).keys()) {
        requests.push({
            url: MAIN_URL,
            uniqueKey: `${x}`,
        });
    }

    const requestList = await Apify.openRequestList('get-cookies', requests);
    const proxyConfiguration = await Apify.createProxyConfiguration({
        groups: ['SHADER'],
        countryCode: 'US',
    });

    const crawler = new Apify.PuppeteerCrawler({
        handlePageTimeoutSecs: 30,
        proxyConfiguration,
        requestList,
        useSessionPool: true,
        persistCookiesPerSession: true,
        autoscaledPoolOptions: {
            desiredConcurrency: 5,
        },
        launchContext: {
            useChrome: true,
            launchOptions: {
                // eslint-disable-next-line
                // @ts-ignore:next-line
                headless: true,
            },
        },
        preNavigationHooks: [
            async ({ page }) => {
                await puppeteer.blockRequests(page);
            },
        ],
        handlePageFunction: async ({ session, request, response }) => {
            session.setCookiesFromResponse(response);
            const cookie = session.getCookieString(request.url);
            store.set((prev) => {
                return {
                    cookies: [...new Set([...prev?.cookies, cookie])],
                };
            });
        },
    });

    await crawler.run();
    await Apify.pushData(store.state);
});
