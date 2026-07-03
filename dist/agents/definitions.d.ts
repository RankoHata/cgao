/**
 * CGAO Agent Definitions
 *
 * Specialized agents for the GitHub automation workflow.
 * Following OMC's pattern: each agent has a clear role, model preference,
 * and prompt loaded from agents/*.md files.
 */
export interface AgentConfig {
    name: string;
    description: string;
    prompt: string;
    model: 'haiku' | 'sonnet' | 'opus';
    tools?: string[];
}
export declare const issueTriageAgent: AgentConfig;
export declare const fixPlannerAgent: AgentConfig;
export declare const prReviewerAgent: AgentConfig;
/** All CGAO agents as a record for SDK usage */
export declare function getAgentDefinitions(): Record<string, {
    description: string;
    prompt: string;
    model?: string;
}>;
