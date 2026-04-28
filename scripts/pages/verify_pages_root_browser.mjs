#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const EXPECTED_TITLE = "Traders Regiment — World's Most Advanced Trading AI";
const EXPECTED_H1 = "TRADERS";
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
  const pageErrors = [];
  const consoleErrors = [];

  page.on("pageerror", (error) => {
    pageErrors.push(collapseWhitespace(error?.stack || error?.message || error));
  });

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    consoleErrors.push(collapseWhitespace(message.text()));
  });

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
    const rootText = collapseWhitespace(
      await page.locator("#root").textContent({ timeout: 5000 }),
    );
    const rootHtmlLength = await page.locator("#root").evaluate(
      (node) => node.innerHTML.length,
    );
    const scriptUrls = await page.locator("script[src]").evaluateAll((nodes) =>
      nodes.map((node) => node.src).filter(Boolean),
    );
    const staleBundleMatches = [];

    for (const scriptUrl of scriptUrls) {
      const scriptResponse = await page.request.get(scriptUrl, {
        timeout: args.timeoutMs,
      });
      if (!scriptResponse.ok()) continue;
      const body = await scriptResponse.text();
      const matches = ["setAdminPassInput", "setAdminPassErr"].filter((token) =>
        body.includes(token),
      );
      if (matches.length > 0) {
        staleBundleMatches.push({ url: scriptUrl, matches });
      }
    }

    const status = response?.status() ?? 0;
    const hasRootContent = rootHtmlLength > 0 && rootText.length > 0;
    const ok =
      status === 200 &&
      title === EXPECTED_TITLE &&
      h1 === EXPECTED_H1 &&
      h1 !== REJECTED_H1 &&
      hasRootContent &&
      pageErrors.length === 0 &&
      consoleErrors.length === 0 &&
      staleBundleMatches.length === 0;

    report = {
      ok,
      url: args.url,
      status,
      h1,
      title,
      hostname,
      hasRootContent,
      rootHtmlLength,
      pageErrors,
      consoleErrors,
      staleBundleMatches,
      expectedTitle: EXPECTED_TITLE,
      expectedH1: EXPECTED_H1,
      rejectedH1: REJECTED_H1,
    };
  } catch (error) {
    report = {
      ok: false,
      url: args.url,
      error: String(error?.message || error),
      expectedTitle: EXPECTED_TITLE,
      expectedH1: EXPECTED_H1,
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
