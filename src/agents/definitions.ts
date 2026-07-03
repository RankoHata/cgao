/**
 * CGAO Agent Definitions
 *
 * Specialized agents for the GitHub automation workflow.
 * Following OMC's pattern: each agent has a clear role, model preference,
 * and prompt loaded from agents/*.md files.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadPrompt(name: string): string {
  // Try multiple locations
  const candidates = [
    join(__dirname, '..', '..', 'agents', `${name}.md`),
    join(process.cwd(), 'agents', `${name}.md`),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return readFileSync(p, 'utf-8');
  }
  // Fallback inline prompts
  return FALLBACK_PROMPTS[name] || `You are the ${name} agent for CGAO.`;
}

const FALLBACK_PROMPTS: Record<string, string> = {
  'issue-triage': `You are the Issue Triage specialist for CGAO.
Your job: analyze GitHub issues and classify them.

Classification criteria:
- BUG: Unexpected behavior, crashes, errors, regressions
- FEATURE: Enhancement requests, new capabilities
- QUESTION: How-to questions, usage inquiries
- DUPLICATE: Already reported elsewhere

For each issue, determine:
1. Type (bug/feature/question/duplicate)
2. Severity (critical/high/medium/low)
3. Estimated scope (large/medium/small)
4. Actionability (ready to fix / needs clarification / out of scope)
5. Recommended action (fix / delegate / skip / ask for details)

Output a structured triage report. Be decisive — don't hedge.`,

  'fix-planner': `You are the Fix Planner for CGAO.
Your job: create structured implementation plans for GitHub issues.

Based on triage results and codebase analysis, produce a plan with:
1. Pre-conditions (what must be true before starting)
2. Ordered implementation steps with file paths
3. Complexity estimate per step
4. Testing strategy per step
5. Post-conditions (verification checklist)
6. Risk assessment and rollback strategy

Be specific about file paths, function names, and expected changes.
If the scope is too large, suggest how to split into smaller PRs.`,

  'pr-reviewer': `You are the PR Reviewer for CGAO.
Your job: perform automated code review of pull requests.

Review dimensions:
1. CORRECTNESS — Does the code fix the issue? Edge cases?
2. SECURITY — Injection, auth, secrets, input validation
3. PERFORMANCE — N+1 queries, memory, blocking operations
4. MAINTAINABILITY — Clarity, naming, function size, patterns
5. TESTING — Coverage, edge cases, regression protection
6. REGRESSION RISK — What could this break?

For each finding, assign severity (CRITICAL/HIGH/MEDIUM/LOW) and provide:
- File and line reference
- What's wrong
- Suggested fix
- Why it matters

Be constructive. Approve when quality is good — don't nitpick.`,
};

export interface AgentConfig {
  name: string;
  description: string;
  prompt: string;
  model: 'haiku' | 'sonnet' | 'opus';
  tools?: string[];
}

export const issueTriageAgent: AgentConfig = {
  name: 'issue-triage',
  description: 'GitHub issue triage specialist — classifies issues and recommends actions (Sonnet)',
  prompt: loadPrompt('issue-triage'),
  model: 'sonnet',
};

export const fixPlannerAgent: AgentConfig = {
  name: 'fix-planner',
  description: 'Fix planning specialist — creates structured implementation plans from issues (Opus)',
  prompt: loadPrompt('fix-planner'),
  model: 'opus',
};

export const prReviewerAgent: AgentConfig = {
  name: 'pr-reviewer',
  description: 'PR code review specialist — multi-dimensional analysis with severity ratings (Opus)',
  prompt: loadPrompt('pr-reviewer'),
  model: 'opus',
};

/** All CGAO agents as a record for SDK usage */
export function getAgentDefinitions(): Record<string, { description: string; prompt: string; model?: string }> {
  const agents: Record<string, AgentConfig> = {
    'issue-triage': issueTriageAgent,
    'fix-planner': fixPlannerAgent,
    'pr-reviewer': prReviewerAgent,
  };
  const result: Record<string, { description: string; prompt: string; model?: string }> = {};
  for (const [name, cfg] of Object.entries(agents)) {
    result[name] = { description: cfg.description, prompt: cfg.prompt, model: cfg.model };
  }
  return result;
}
