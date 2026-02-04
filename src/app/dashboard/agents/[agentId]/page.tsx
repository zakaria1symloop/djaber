'use client';

import { useParams } from 'next/navigation';
import AgentForm from '../_components/AgentForm';

export default function EditAgentPage() {
  const params = useParams();
  return <AgentForm agentId={params.agentId as string} />;
}
