#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_REPORT = path.join(
  ROOT,
  "output",
  "playwright",
  "website-user-audit",
  "website-user-audit-report.json",
);
const DEFAULT_OUTPUT = path.join(
  ROOT,
  "output",
  "playwright",
  "website-user-audit",
  "opencli-summary.md",
);

function parseArgs(argv) {
  const args = {
    report: process.env.WEBSITE_AUDIT_REPORT || DEFAULT_REPORT,
    output: process.env.WEBSITE_AUDIT_SUMMARY || DEFAULT_OUTPUT,
    useAi: process.env.WEBSITE_AUDIT_OPENCLI !== "false",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--report") {
      args.report = value;
      index += 1;
    } else if (key === "--output") {
      args.output = value;
      index += 1;
    } else if (key === "--no-ai") {
      args.useAi = false;
    }
  }

  args.report = path.resolve(args.report);
  args.output = path.resolve(args.output);
  return args;
}

function redact(value) {
  return String(value ?? "")
    .replace(/gh[pousr]_[A-Za-z0-9_]{20,}/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/gsk_[A-Za-z0-9_-]{20,}/g, "[REDACTED_GROQ_KEY]")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "[REDACTED_API_KEY]")
    .replace(
      /\b[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}\b/g,
      "[REDACTED_UUID]",
    )
    .replace(
      /((?:api[_-]?key|token|password|secret|access_token)=)[^&\s"']+/gi,
      "$1[REDACTED]",
    )
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[REDACTED]");
}

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitize(item)]),
    );
  }
  if (typeof value === "string") return redact(value);
  return value;
}

function loadReport(reportPath) {
  return sanitize(JSON.parse(fs.readFileSync(reportPath, "utf8")));
}

function compactReport(report) {
  return {
    ok: report.ok,
    target: report.target,
    baseUrl: report.baseUrl,
    commit: report.commit,
    summary: report.summary,
    scenarios: (report.scenarios || []).map((scenario) => ({
      id: scenario.id,
      status: scenario.status,
      durationMs: scenario.durationMs,
      errors: scenario.errors || [],
      consoleErrors: (scenario.consoleErrors || [])
        .filter((entry) => entry.type === "error")
        .slice(0, 8),
      networkFailures: (scenario.networkFailures || []).slice(0, 8),
      screenshotPath: scenario.screenshotPath,
      tracePath: scenario.tracePath,
    })),
  };
}

function deterministicSummary(report, note = "") {
  const failed = (report.scenarios || []).filter(
    (scenario) => scenario.status !== "passed",
  );
  const brokenAreas = failed.map((scenario) => scenario.id).join(", ") || "none";
  const evidence = failed
    .map((scenario) => {
      const firstError = scenario.errors?.[0] || "No error detail captured.";
      return `- ${scenario.id}: ${firstError}`;
    })
    .join("\n");

  return redact(`# OpenCLI Website User Audit Summary

## User Impact
${report.ok ? "No critical user journey failures were found." : `Users may hit failures in: ${brokenAreas}.`}

## Likely Broken Area
${report.ok ? "No broken area detected by the deterministic Playwright audit." : brokenAreas}

## Suggested Fix Order
${report.ok ? "1. Keep the current audit running on PRs, deploys, and nightly checks." : failed.map((scenario, index) => `${index + 1}. Fix ${scenario.id} using the screenshot and trace artifact first.`).join("\n")}

## Evidence
${evidence || "- All scenarios passed."}

${note ? `## OpenCode Status\n${note}\n` : ""}`.trim() + "\n");
}

function chooseOpenCodeModel() {
  if (process.env.SAMBANOVA_API_KEY) {
    return "";
  }
  if (process.env.AI_SAMBANOVA_TR_1_KEY) {
    return "sambanova-tr-1/Meta-Llama-3.3-70B-Instruct";
  }
  if (process.env.AI_SAMBANOVA_TR_2_KEY) {
    return "sambanova-tr-2/Meta-Llama-3.3-70B-Instruct";
  }
  if (process.env.AI_SAMBANOVA_TR_3_KEY) {
    return "sambanova-tr-3/Meta-Llama-3.3-70B-Instruct";
  }
  if (process.env.AI_SAMBANOVA_TR_4_KEY) {
    return "sambanova-tr-4/Meta-Llama-3.3-70B-Instruct";
  }
  return "";
}

function hasOpenCodeCredentials() {
  return Boolean(
    process.env.SAMBANOVA_API_KEY ||
      process.env.AI_SAMBANOVA_TR_1_KEY ||
      process.env.AI_SAMBANOVA_TR_2_KEY ||
      process.env.AI_SAMBANOVA_TR_3_KEY ||
      process.env.AI_SAMBANOVA_TR_4_KEY,
  );
}

function extractOpenCodeText(stdout) {
  const lines = String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const chunks = [];

  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      const text =
        event?.message?.content?.[0]?.text ||
        event?.content?.[0]?.text ||
        event?.delta?.text ||
        event?.text ||
        "";
      if (text) chunks.push(text);
    } catch {
      // Ignore non-JSON status lines.
    }
  }

  return chunks.join("").trim();
}

function runOpenCodeSummary(report, outputDir) {
  const context = compactReport(report);
  const contextPath = path.join(
    os.tmpdir(),
    `website-user-audit-${Date.now()}-${process.pid}.json`,
  );
  fs.writeFileSync(contextPath, `${JSON.stringify(context, null, 2)}\n`, "utf8");

  const prompt = [
    "Summarize this redacted website user audit for the repo owner.",
    "Use only the attached JSON. Do not call tools. Do not include secrets.",
    "Return concise Markdown with exactly these sections:",
    "## User Impact",
    "## Likely Broken Area",
    "## Suggested Fix Order",
    "## Evidence",
  ].join("\n");

  const model = chooseOpenCodeModel();
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const args = [
    "opencode",
    "run",
    "--pure",
    "--dangerously-skip-permissions",
    "--format",
    "json",
    "--file",
    contextPath,
  ];
  if (model) {
    args.push("--model", model);
  }
  args.push(prompt);

  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 120_000,
    env: process.env,
  });

  fs.rmSync(contextPath, { force: true });

  if (result.status !== 0) {
    const reason = redact(result.stderr || result.stdout || "OpenCode failed.");
    return {
      ok: false,
      markdown: deterministicSummary(
        report,
        `OpenCode summary failed; deterministic summary used instead.\n\n\`\`\`text\n${reason.slice(0, 1200)}\n\`\`\``,
      ),
    };
  }

  const markdown = extractOpenCodeText(result.stdout) || result.stdout;
  const cleanMarkdown = redact(markdown).trim();
  if (!cleanMarkdown) {
    return {
      ok: false,
      markdown: deterministicSummary(
        report,
        "OpenCode returned no summary text; deterministic summary used instead.",
      ),
    };
  }

  return { ok: true, markdown: `${cleanMarkdown}\n` };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  const report = loadReport(args.report);

  let markdown;
  if (!args.useAi) {
    markdown = deterministicSummary(report, "OpenCode disabled by --no-ai.");
  } else if (!hasOpenCodeCredentials()) {
    markdown = deterministicSummary(
      report,
      "OpenCode provider secrets were unavailable, so AI summary was skipped.",
    );
  } else {
    markdown = runOpenCodeSummary(report, path.dirname(args.output)).markdown;
  }

  fs.writeFileSync(args.output, markdown, "utf8");
  console.log(`OpenCLI summary written to ${path.relative(ROOT, args.output)}`);
}

main();
