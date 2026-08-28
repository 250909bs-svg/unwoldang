import { expect, test as base, type Page, type Response } from '@playwright/test';
import {
  activeProductFlows,
  customerFixture,
  type ActiveProductFlow
} from './fixtures/products';

const test = base.extend<{ externalTrafficGuard: void }>({
  externalTrafficGuard: [
    async ({ page }, use) => {
      const unexpectedExternalRequests: string[] = [];

      await page.addInitScript(() => {
        const browserWindow = window as typeof window & {
          PortOne?: {
            requestPayment: (request: Record<string, unknown>) => Promise<{ paymentId: string; txId: string }>;
          };
        };

        browserWindow.PortOne = {
          requestPayment: async (request: Record<string, unknown>) => {
            const paymentId = typeof request.paymentId === 'string' ? request.paymentId : '';
            return { paymentId, txId: `e2e-tx-${paymentId}` };
          }
        };
      });

      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());

        if (url.hostname === 'kauth.kakao.com' && url.pathname === '/oauth/authorize') {
          const redirectUri = url.searchParams.get('redirect_uri');
          const state = url.searchParams.get('state');

          if (!redirectUri || !state) {
            unexpectedExternalRequests.push(url.toString());
            await route.fulfill({ status: 400, body: 'Malformed E2E Kakao authorize request.' });
            return;
          }

          const callbackUrl = new URL(redirectUri);
          callbackUrl.searchParams.set('code', 'e2e-kakao-code');
          callbackUrl.searchParams.set('state', state);
          await route.fulfill({
            status: 302,
            headers: { location: callbackUrl.toString() },
            body: ''
          });
          return;
        }

        if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
          await route.fulfill({
            status: 200,
            contentType: url.hostname === 'fonts.googleapis.com' ? 'text/css' : 'font/woff2',
            body: ''
          });
          return;
        }

        const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
        const isLoopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost';

        if (isHttp && !isLoopback) {
          unexpectedExternalRequests.push(url.toString());
          await route.abort('blockedbyclient');
          return;
        }

        await route.continue();
      });

      await use();

      expect(
        unexpectedExternalRequests,
        'E2E must not call production payment, authentication, archive, or AI endpoints.'
      ).toEqual([]);
    },
    { auto: true }
  ]
});

async function expectPath(page: Page, pathname: string) {
  await expect.poll(() => new URL(page.url()).pathname).toBe(pathname);
}

async function clickVisibleLink(page: Page, href: string) {
  const link = page.locator(`a[href="${href}"]:visible`).first();
  await expect(link).toBeVisible();
  await link.click();
}

async function openIntakeFromHome(page: Page, flow: ActiveProductFlow) {
  await page.goto('/');
  await expectPath(page, '/');
  await clickVisibleLink(page, flow.detailPath);
  await expectPath(page, flow.detailPath);

  if (flow.id === 'past-life-goblin') {
    await clickVisibleLink(page, '/detail/past-life-goblin/immersion');
    await expectPath(page, '/detail/past-life-goblin/immersion');
  }

  await clickVisibleLink(page, flow.intakePath);
}

function waitForApiResponse(page: Page, method: string, pathname: string) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === method && url.pathname === pathname;
  });
}

async function expectOk(response: Response) {
  expect(response.status(), `${response.request().method()} ${new URL(response.url()).pathname}`).toBe(200);
  return response.json() as Promise<Record<string, unknown>>;
}

async function completeKakaoLogin(page: Page, returnTo: string) {
  await expectPath(page, '/login');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = window.history.state as { usr?: { returnTo?: string } } | null;
        return state?.usr?.returnTo;
      })
    )
    .toBe(returnTo);

  const exchangeResponsePromise = waitForApiResponse(page, 'POST', '/api/auth/kakao/exchange');
  await page.locator('.login-kakao-main-button').click();
  const exchangeResponse = await exchangeResponsePromise;
  expect(exchangeResponse.request().postDataJSON()).toEqual({
    code: 'e2e-kakao-code',
    redirectUri: 'http://127.0.0.1:42713/auth/kakao/callback'
  });
  const exchange = await expectOk(exchangeResponse);
  expect(exchange.authToken).toBe('e2e-access-token-opaque');
  expect(exchange.user).toEqual(expect.objectContaining({ id: 'e2e-user-001' }));
  await expectPath(page, returnTo);
}

async function fillBirthStep(page: Page) {
  const primaryButton = page.locator('.intake-story-primary');
  await expect(primaryButton).toBeDisabled();
  await page.locator('input[type="text"]').first().fill(customerFixture.name);
  await page.locator('input[placeholder="19901231"]').first().fill(customerFixture.birthDate);
  await page.getByRole('button', { name: /\uc2dc\uac04 \ubaa8\ub984/ }).first().click();
  const genderButton = page.getByRole('button', { name: '\uc5ec\uc131', exact: true }).first();
  if (!(await genderButton.evaluate((element) => element.classList.contains('active')))) {
    await genderButton.click();
  }
  await expect(primaryButton).toBeEnabled();
  await primaryButton.click();
}

async function fillCommonIntake(page: Page, flow: ActiveProductFlow) {
  const primaryButton = page.locator('.intake-story-primary');
  await fillBirthStep(page);

  if (flow.formKind === 'past-life') {
    await page.locator('.past-life-choice-grid.topic-grid button').first().click();
  } else if (flow.formKind === 'compatibility') {
    await page.getByPlaceholder(/\uc0c1\ub300\ubc29\uc744 \uad6c\ubd84\ud560 \uc774\ub984/).fill(customerFixture.partnerName);
    await page.getByRole('button', { name: '\ub0a8\uc131', exact: true }).first().click();
    await page.locator('input[placeholder="19901231"]').fill(customerFixture.partnerBirthDate);
    await page.getByRole('button', { name: /\uc2dc\uac04 \ubaa8\ub984/ }).click();
  } else {
    await page.locator('.intake-relationship-card').first().click();
    await page.locator('.intake-duration-chip').first().click();
  }

  await expect(primaryButton).toBeEnabled();
  await primaryButton.click();

  if (flow.formKind === 'past-life') {
    const pastLifeAnswers = page.locator('.past-life-text-card textarea');
    await pastLifeAnswers.nth(0).fill('I repeatedly take responsibility for work that was not mine.');
    await pastLifeAnswers.nth(1).fill('I feel tired and unfairly responsible.');
    await pastLifeAnswers.nth(2).fill('I want recognition without carrying every burden.');
  } else {
    await page.locator('textarea').fill(customerFixture.questionOne);
  }

  await expect(primaryButton).toBeEnabled();
  await primaryButton.click();

  if (flow.formKind === 'past-life') {
    await page.locator('.past-life-choice-grid.symbol-grid button').first().click();
    await page.locator('.past-life-choice-grid.tone-grid button').first().click();
  } else {
    await page.locator('textarea').fill(customerFixture.questionTwo);
  }

  await expect(primaryButton).toBeEnabled();
  await primaryButton.click();
  await expectPath(page, '/checkout');
}

async function fillLoveReadingIntake(page: Page) {
  await page.getByPlaceholder('2000.01.01').fill('1990.01.15');
  await page.locator('.mz-love-intake-unknown').click();
  await page.locator('.mz-love-intake-option-stack--gender button').last().click();
  await page.getByPlaceholder(/\ud64d\uae38\ub3d9/).fill(customerFixture.name);
  await page.locator('.mz-love-intake-name-confirm').click();
  await page.locator('.mz-love-intake-option-stack button').first().click();
  await page.locator('.mz-love-intake-option-stack button').first().click();

  const questions = page.locator('.mz-love-intake-question-stack textarea');
  await questions.nth(0).fill(customerFixture.questionOne);
  await questions.nth(1).fill(customerFixture.questionTwo);
  await page.locator('.mz-love-intake-footer button').click();
  await expectPath(page, '/preview/love-reading');

  await page.locator('.mz-love-story-unlock').click();
  await completeKakaoLogin(page, '/preview/love-reading');
  await page.locator('.mz-love-story-unlock').click();
  await expectPath(page, '/checkout');
}

async function completeLivePayment(page: Page, flow: ActiveProductFlow) {
  const priceLabel = `${flow.price.toLocaleString('ko-KR')}\uc6d0`;
  await expect(page.getByText(priceLabel, { exact: true }).first()).toBeVisible();

  const paymentButton = page.locator('.checkout-luxe-general-pay');
  await expect(paymentButton).toHaveAttribute('aria-disabled', 'true');

  const agreements = page.locator('.checkout-luxe-check input[type="checkbox"]');
  await agreements.nth(0).check();
  await agreements.nth(1).check();
  await expect(paymentButton).toHaveAttribute('aria-disabled', 'false');

  const orderResponsePromise = waitForApiResponse(page, 'POST', '/api/payments/portone/order');
  const confirmResponsePromise = waitForApiResponse(page, 'POST', '/api/payments/portone/confirm');
  const reportResponsePromise = waitForApiResponse(page, 'POST', '/api/report');
  const archiveResponsePromise = waitForApiResponse(page, 'POST', '/api/archive/reports');
  await paymentButton.click();

  const orderResponse = await orderResponsePromise;
  const orderRequest = orderResponse.request().postDataJSON();
  const order = await expectOk(orderResponse);
  expect(orderRequest).toMatchObject({
    productId: flow.id,
    amount: flow.price
  });
  expect(order).toMatchObject({
    productId: flow.id,
    amount: flow.price,
    currency: 'KRW'
  });
  expect(order.orderId).toEqual(expect.stringMatching(/^UW-/));

  const confirmResponse = await confirmResponsePromise;
  const confirmationRequest = confirmResponse.request().postDataJSON();
  const confirmation = await expectOk(confirmResponse);
  expect(confirmationRequest).toMatchObject({
    orderId: order.orderId,
    productId: flow.id,
    amount: flow.price,
    orderClaim: order.orderClaim
  });
  expect(confirmation).toMatchObject({
    orderId: order.orderId,
    productId: flow.id,
    amount: flow.price,
    currency: 'KRW',
    status: 'PAID'
  });
  expect(confirmation.reportAccessToken).toEqual(expect.stringContaining(String(order.orderId)));

  await expectPath(page, '/loading');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  const reportResponse = await reportResponsePromise;
  expect(reportResponse.status()).toBe(200);
  expect(reportResponse.headers()['x-e2e-cache']).toBe('MISS');
  const reportRequest = reportResponse.request().postDataJSON();
  expect(reportRequest).toMatchObject({
    serviceId: flow.id,
    orderId: order.orderId
  });

  await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).toBe(`/report/${flow.id}`);
  const renderedReport = await page.evaluate(() => {
    const state = window.history.state as {
      usr?: { reportData?: { serviceId?: string; serialNumber?: string; title?: string } };
    } | null;
    return state?.usr?.reportData;
  });
  expect(renderedReport).toMatchObject({
    serviceId: flow.id, serialNumber: order.orderId, title: expect.stringContaining('[E2E fixture]')
  });
  const archiveResponse = await archiveResponsePromise;
  expect(archiveResponse.status()).toBe(200);
  expect(archiveResponse.request().postDataJSON()).toMatchObject({
    entry: {
      orderId: order.orderId,
      productId: flow.id
    },
    reportAccessToken: confirmation.reportAccessToken
  });

  const myPageLink = page.locator('a[aria-label="\ub9c8\uc774\ud398\uc774\uc9c0"]:visible').first();
  await expect(myPageLink).toBeVisible({ timeout: 30_000 });
  const archiveReadResponsePromise = waitForApiResponse(page, 'GET', '/api/archive/reports');
  const entitlementsResponsePromise = waitForApiResponse(page, 'GET', '/api/payments/portone/entitlements');
  await myPageLink.click();
  await expectPath(page, '/my');

  const archiveReadResponse = await archiveReadResponsePromise;
  expect(archiveReadResponse.status()).toBe(200);
  expect(Number(archiveReadResponse.headers()['x-e2e-archive-count'])).toBeGreaterThan(0);
  const entitlements = await expectOk(await entitlementsResponsePromise);
  expect(entitlements).toMatchObject({
    entitlements: expect.arrayContaining([
      expect.objectContaining({
        orderId: order.orderId,
        productId: flow.id,
        amount: flow.price
      })
    ])
  });

  const archivedReport = page.locator(`a.my-report-replay-card[href="/report/${flow.id}"]`);
  await expect(archivedReport).toBeVisible();
  await archivedReport.click();
  await expectPath(page, `/report/${flow.id}`);
}

for (const flow of activeProductFlows) {
  test(`${flow.id}: home to owned report archive`, async ({ page, request }) => {
    const mockHealth = await request.get('http://127.0.0.1:42714/health');
    expect(mockHealth.ok()).toBe(true);
    expect(await mockHealth.json()).toMatchObject({ service: 'unwoldang-e2e-mock' });

    await test.step('home to product detail and intake', async () => {
      await openIntakeFromHome(page, flow);
    });

    await test.step('Kakao callback mock and validated input', async () => {
      if (flow.formKind === 'love-reading') {
        await expectPath(page, flow.intakePath);
        await fillLoveReadingIntake(page);
      } else {
        await completeKakaoLogin(page, flow.intakePath);
        await fillCommonIntake(page, flow);
      }
    });

    await test.step('live API transport, loading, report, and My archive', async () => {
      await completeLivePayment(page, flow);
    });
  });
}
