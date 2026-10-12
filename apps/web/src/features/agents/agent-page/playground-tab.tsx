'use client';
// /agents/[id]/playground — the playground of the agent of the page; `?scenario=<TestScenarioKey>` runs one of the
// 8 automatic scenarios when the tab opens (links of the wizard and of the scenario list).
import { TestScenarioKeyValues, type TestScenarioKey } from '@djaber/shared';
import { useSearchParams } from 'next/navigation';
import { AgentPlayground } from '../playground/playground';
import { useAgentPage } from './agent-shell';

export function AgentPlaygroundTab() {
  const { agent } = useAgentPage();
  const raw = useSearchParams().get('scenario');
  const scenario = (TestScenarioKeyValues as readonly string[]).includes(raw ?? '') ? (raw as TestScenarioKey) : null;
  return <AgentPlayground key={agent.id} agent={agent} initialScenario={scenario} />;
}
