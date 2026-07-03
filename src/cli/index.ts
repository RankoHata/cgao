#!/usr/bin/env node
/**
 * CGAO CLI — lightweight setup and diagnostic tool
 */
import { existsSync } from 'fs';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const cmd = args[0] || 'help';

function run(c: string) { try { return execSync(c, { encoding: 'utf-8', stdio: 'pipe' }).trim(); } catch { return null; } }

async function main() {
  switch (cmd) {
    case 'setup': {
      console.log('CGAO Setup\n==========');
      // Check gh
      const gh = run('gh --version');
      console.log(gh ? `✅ gh CLI: ${gh.split('\n')[0]}` : '❌ gh CLI not found. Install: https://cli.github.com');

      // Check token
      const token = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
      if (token) {
        console.log('✅ GITHUB_PAT/GITHUB_TOKEN is set');
      } else {
        const ghToken = run('gh auth token');
        console.log(ghToken ? '✅ gh auth token available' : '⚠️  No GitHub token. Set GITHUB_PAT or run `gh auth login`');
      }

      // Check official GitHub MCP
      const mcpCheck = run('claude mcp list 2>/dev/null');
      console.log(mcpCheck?.includes('github') ? '✅ Official GitHub MCP registered' : '⚠️  Official GitHub MCP not registered. Run: claude mcp add github ...');
      break;
    }

    case 'status': {
      const r = run('git remote get-url origin');
      console.log(r ? `Repo: ${r}` : 'Not in a git repo');
      if (existsSync('.cgao')) {
        const files = run('ls .cgao/')?.split('\n').filter(Boolean) || [];
        console.log(`Workflows: ${files.filter(f => f.startsWith('workflow-')).length} active`);
        console.log(`Triages: ${files.filter(f => f.startsWith('triage-')).length}`);
        console.log(`Plans: ${files.filter(f => f.startsWith('plan-')).length}`);
      }
      break;
    }

    case 'help':
    default:
      console.log(`CGAO — Claude GitHub Auto Orchestra v0.1.0

Usage:
  cgao setup        Check and configure prerequisites
  cgao status       Show CGAO workflow state

Plugins (in Claude Code):
  /cgao:scan        Discover and triage issues
  /cgao:evaluate    Deep evaluation of a specific issue
  /cgao:fix         Plan and implement a fix
  /cgao:pr-create   Create a pull request
  /cgao:review      Automated PR code review
  /cgao:monitor     Monitor PR merge status

MCP Tools (used by skills):
  mcp__cgao__cgao_triage_issue       Classify and assess an issue
  mcp__cgao__cgao_analyze_codebase   Find relevant code for an issue
  mcp__cgao__cgao_plan_fix           Generate structured fix plan
  mcp__cgao__cgao_assess_pr_quality  Automated PR quality checks
  mcp__cgao__cgao_check_merge_readiness  Merge blocker analysis
  mcp__cgao__cgao_workflow_state     Track workflow progress`);
      break;
  }
}

main().catch(console.error);
