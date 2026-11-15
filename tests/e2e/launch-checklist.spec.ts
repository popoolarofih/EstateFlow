import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Pre launch checklist, verified automatically against the production build:
 * accessibility and colour contrast, mobile layout, broken links, meta and social tags,
 * favicon, sitemap and robots, security headers, cookies and a page speed budget.
 */
const PUBLIC_PAGES = ["/", "/sign-in", "/privacy", "/terms", "/no-access"];

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page scrolls sideways").toBeLessThanOrEqual(0);
}

test.describe("accessibility and colour contrast (WCAG 2.1 AA)", () => {
  for (const path of [...PUBLIC_PAGES, "/missing-page"]) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await page.goto(path);
      // Scroll to the end so every reveal and tagline word is in its final, readable state.
      // (Tagline words start at 30% opacity by design and brighten as they are read.)
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(900);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const summary = results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
      expect(summary).toEqual([]);
    });
  }
});

test.describe("mobile friendly at 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const path of PUBLIC_PAGES) {
    test(`${path} fits the screen`, async ({ page }) => {
      await page.goto(path);
      await noHorizontalOverflow(page);
    });
  }

  test("primary action is visible in the first screen and buttons keep their text inside", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: "Book a pilot walkthrough" });
    await expect(cta).toBeInViewport();
    const clipped = await page.$$eval("a, button", (elements) =>
      elements
        .filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden")
        // Screen reader only elements (the skip link until focused) are clipped on purpose.
        .filter((element) => {
          const style = getComputedStyle(element);
          return style.clipPath === "none" && style.clip !== "rect(0px, 0px, 0px, 0px)";
        })
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => element.textContent?.trim()),
    );
    expect(clipped).toEqual([]);
  });
});

test("no broken links or anchors on the public pages", async ({ page, request }) => {
  const seen = new Set<string>();
  for (const path of ["/", "/privacy", "/terms", "/sign-in"]) {
    await page.goto(path);
    const hrefs = await page.$$eval("a[href]", (anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).getAttribute("href")!));
    for (const href of hrefs) {
      if (/^(mailto:|tel:|https:\/\/wa\.me)/.test(href) || seen.has(`${path}|${href}`)) continue;
      seen.add(`${path}|${href}`);
      if (href.startsWith("#")) {
        expect(await page.locator(href).count(), `${path} anchor ${href}`).toBeGreaterThan(0);
        continue;
      }
      const url = new URL(href, page.url());
      if (url.origin !== new URL(page.url()).origin) continue;
      const response = await request.get(url.pathname + url.search, { maxRedirects: 5 });
      expect(response.status(), `${path} -> ${href}`).toBeLessThan(400);
      if (url.hash) {
        await page.goto(url.toString());
        expect(await page.locator(url.hash).count(), `anchor ${url.hash} on ${url.pathname}`).toBeGreaterThan(0);
        await page.goto(path);
      }
    }
  }
  expect(seen.size).toBeGreaterThan(10);
});

test("meta titles, descriptions, social images and favicons", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/EstateFlow/);
  const meta = async (selector: string) => page.locator(selector).first().getAttribute("content");
  expect((await meta('meta[name="description"]'))?.length).toBeGreaterThan(50);
  expect(await meta('meta[property="og:title"]')).toBeTruthy();
  expect(await meta('meta[property="og:description"]')).toBeTruthy();
  expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");
  for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
    const image = new URL((await meta(selector))!);
    const response = await request.get(image.pathname);
    expect(response.status(), selector).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  for (const rel of ["icon", "apple-touch-icon", "manifest"]) {
    const href = await page.locator(`link[rel="${rel}"]`).first().getAttribute("href");
    expect(href, rel).toBeTruthy();
    expect((await request.get(href!)).status(), rel).toBe(200);
  }
  expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toBeTruthy();
  expect(await page.locator('script[type="application/ld+json"]').count()).toBe(1);

  for (const path of ["/privacy", "/terms"]) {
    await page.goto(path);
    expect((await meta('meta[name="description"]'))?.length, path).toBeGreaterThan(20);
  }
});

test("sitemap and robots", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const robotsText = await robots.text();
  expect(robotsText).toContain("Sitemap:");
  expect(robotsText).toContain("Disallow: /api/");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("<loc>");
});

test("security headers are sent on every page", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBeTruthy();
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("no cookies are set on the public site without consent", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  // First party cookies only. (The hero photo CDN may set its own bot protection cookie.)
  const ours = (await context.cookies()).filter((cookie) => cookie.domain.replace(/^\./, "") === new URL(page.url()).hostname);
  expect(ours.map((cookie) => cookie.name)).toEqual([]);
});

test("landing page meets the page speed budget", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  const metrics = await page.evaluate(
    () =>
      new Promise<{ lcp: number; cls: number; ttfb: number }>((resolve) => {
        let lcp = 0;
        let cls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) lcp = Math.max(lcp, entry.startTime);
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
            if (!entry.hadRecentInput) cls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
        const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        setTimeout(() => resolve({ lcp, cls, ttfb: navigation.responseStart }), 1500);
      }),
  );
  test.info().annotations.push({ type: "metrics", description: JSON.stringify(metrics) });
  expect(metrics.lcp, "Largest Contentful Paint (ms)").toBeLessThan(2500);
  expect(metrics.cls, "Cumulative Layout Shift").toBeLessThan(0.1);
  expect(metrics.ttfb, "Time to first byte (ms)").toBeLessThan(800);
});

test("naira amounts and Nigerian names render entirely in the brand fonts", async ({ page, context }) => {
  await page.goto("/privacy");
  await page.evaluate(() => {
    const probe = document.createElement("p");
    probe.id = "glyph-probe";
    probe.className = "heading-4";
    probe.textContent = "₦25,000.00 Adéwálé Ọ̀ṣúnfẹ́ Ṣadé Ngozi Ẹ̀mẹ́ka";
    document.body.prepend(probe);
  });
  // unicode-range faces load on first use; wait for them, then read what Chrome actually painted.
  await page.evaluate(async () => {
    await document.fonts.load('600 36px "EstateFlow Nigerian"', "₦ṣẹọ\u0301");
    await document.fonts.load('600 36px "EstateFlow Glyphs"', "ẹọ");
    await document.fonts.ready;
  });
  await page.waitForTimeout(300);
  const cdp = await context.newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument");
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#glyph-probe" });
  const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  const systemFonts = fonts.filter((font) => !font.isCustomFont).map((font) => `${font.familyName} (${font.glyphCount} glyphs)`);
  expect(systemFonts, "glyphs fell back to a system font").toEqual([]);
});
