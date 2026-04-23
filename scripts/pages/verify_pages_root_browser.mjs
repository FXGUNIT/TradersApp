#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const EXPECTED_TITLE = "TradersApp";
const EXPECTED_H1 = "Welcome back";
const EXPECTED_PRIMARY_CTA = "Continue with Google";
const REJECTED_H1 = "Developer root for Gunit's live trading infrastructure.";

function parseArgs(argv) {
  const args = {
    url: "https://tradergunit.pages.dev",
    output: "",
    timeoutMs: 60000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--url") {
      args.url = value;
      i += 1;
    } else if (key === "--output") {
      args.output = value;
      i += 1;
    } else if (key === "--timeout-ms") {
      args.timeoutMs = Number(value || "60000");
      i += 1;
    }
  }

  if (!args.output) {
    throw new Error("--output is required");
  }

  return args;
}

function collapseWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = path.resolve(args.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let report;
  try {
    const response = await page.goto(args.url, {
      waitUntil: "networkidle",
      timeout: args.timeoutMs,
    });
    await page.waitForSelector("h1", { timeout: args.timeoutMs });
    const h1 = collapseWhitespace(await page.locator("h1").first().textContent());
    const title = collapseWhitespace(await page.title());
    const hostname = await page.evaluate(() => window.location.hostname);
    const ctaVisible = await page
      .getByRole("button", { name: EXPECTED_PRIMARY_CTA })
      .isVisible()
      .catch(() => false);
    const status = response?.status() ?? 0;
    const ok =
      status === 200 &&
      title === EXPECTED_TITLE &&
      h1 === EXPECTED_H1 &&
      ctaVisible &&
      h1 !== REJECTED_H1;

    report = {
      ok,
      url: args.url,
      status,
      h1,
      title,
      hostname,
      ctaVisible,
      expectedTitle: EXPECTED_TITLE,
      expectedH1: EXPECTED_H1,
      expectedPrimaryCta: EXPECTED_PRIMARY_CTA,
      rejectedH1: REJECTED_H1,
    };
  } catch (error) {
    report = {
      ok: false,
      url: args.url,
      error: String(error?.message || error),
      expectedTitle: EXPECTED_TITLE,
      expectedH1: EXPECTED_H1,
      expectedPrimaryCta: EXPECTED_PRIMARY_CTA,
      rejectedH1: REJECTED_H1,
    };
  } finally {
    await page.close();
    await browser.close();
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (!report.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
