import type { CensusAnswer, Message } from '../shared/contracts';

function formatAnswer(answer: CensusAnswer): string {
  const rowsTable = answer.rows.length
    ? [
        '| Rank | Community | Values |',
        '| --- | --- | --- |',
        ...answer.rows.map((row) => `| ${row.rank ?? '—'} | ${row.geography} | ${Object.entries(row.values)
          .map(([key, value]) => `${key.replaceAll(/([A-Z])/g, ' $1')}: ${typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}`)
          .join(' · ')} |`),
      ].join('\n')
    : '_No result rows._';

  const warnings = answer.warnings.length ? answer.warnings.map((warning) => `> ! ${warning}`).join('\n') : '';

  const evidence = answer.evidence;
  const evidenceSection = [
    '**Evidence**',
    `- Dataset: ${evidence.dataset}`,
    `- Vintage: ${evidence.vintage}`,
    `- Geography: ${evidence.geography}`,
    `- Calculation: ${evidence.calculation}`,
    `- Filters: ${Object.entries(evidence.filters).map(([key, value]) => `${key}: ${value}`).join(' · ') || 'none'}`,
    `- Variables: ${evidence.variables.map((variable) => `${variable.id} · ${variable.label}`).join(' / ')}`,
    `- Source requests: ${evidence.requests.map((request) => `[${request.vintage} ACS](${request.url})`).join(', ') || 'none'}`,
  ].join('\n');

  return [answer.summary, '', rowsTable, warnings, '', evidenceSection].filter(Boolean).join('\n');
}

export function buildTranscriptMarkdown(messages: Message[]): string {
  const generatedAt = new Date().toISOString();
  const header = [`# CensusSense Conversation Transcript`, '', `_Generated ${generatedAt}_`, ''];

  const body = messages
    .filter((message) => message.kind !== 'activity')
    .map((message) => {
      const heading = message.role === 'user' ? 'You asked' : 'CensusSense';
      const timestamp = new Date(message.createdAt).toLocaleString();
      const parts = [`## ${heading} · ${timestamp}`, '', message.text];
      if (message.answer) parts.push('', formatAnswer(message.answer));
      return parts.join('\n');
    });

  return [...header, ...body].join('\n\n');
}
