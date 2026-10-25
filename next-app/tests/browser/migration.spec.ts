import { expect, type Page, test } from "@playwright/test";

/**
 * What a visitor experiences in a real browser while both systems serve the same site.
 * A marker on `window` survives client-side navigation but not a full page load, which tells the two apart.
 */

const LEGACY_BANNER = "Served by the legacy PHP application";

const markWindow = (page: Page) =>
  page.evaluate(() => ((window as unknown as { __marker?: string }).__marker = "same-document"));

const windowMarker = (page: Page) =>
  page.evaluate(() => (window as unknown as { __marker?: string }).__marker ?? null);

test("a migrated article opens with client-side navigation, without a full page load", async ({ page }) => {
  await page.goto("/articles");
  await markWindow(page);

  await page.getByRole("link", { name: "Hello, Next.js: Why We Are Migrating" }).click();

  await expect(page).toHaveURL("/articles/hello-nextjs");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hello, Next.js: Why We Are Migrating");
  await expect(page).toHaveTitle("Hello, Next.js: Why We Are Migrating | Articles");
  await expect(page.getByText(LEGACY_BANNER)).toHaveCount(0);
  expect(await windowMarker(page)).toBe("same-document");
});

test("an unmigrated article is handed to legacy PHP under the same URL, query string included", async ({
  page,
}) => {
  await page.goto("/articles");
  await markWindow(page);

  await page.getByRole("link", { name: "Caching Strategies for Content Sites" }).click();

  await expect(page).toHaveURL("/articles/caching-strategies");
  await expect(page.getByText(LEGACY_BANNER)).toBeVisible();
  expect(await windowMarker(page)).toBeNull(); // a full page load, so the proxy could forward it

  await page.goto("/articles/php-legacy-patterns?utm_source=newsletter&page=2");
  await expect(page).toHaveURL("/articles/php-legacy-patterns?utm_source=newsletter&page=2");
  await expect(page.getByText(LEGACY_BANNER)).toBeVisible();
  await expect(page.getByText("?utm_source=newsletter&page=2")).toBeVisible();
});

test("Back and Forward work across Next.js and legacy pages", async ({ page }) => {
  await page.goto("/articles/hello-nextjs");
  await page.getByRole("link", { name: "All articles" }).click();
  await expect(page).toHaveURL("/articles");

  await page.getByRole("link", { name: "Caching Strategies for Content Sites" }).click();
  await expect(page.getByText(LEGACY_BANNER)).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL("/articles");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Articles");
  await expect(page.getByText(LEGACY_BANNER)).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL("/articles/hello-nextjs");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hello, Next.js: Why We Are Migrating");

  await page.goForward();
  await page.goForward();
  await expect(page).toHaveURL("/articles/caching-strategies");
  await expect(page.getByText(LEGACY_BANNER)).toBeVisible();
});
