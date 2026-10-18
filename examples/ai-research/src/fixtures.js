// Deterministic fixtures for the research assistant demo. Everything here is simulated.
import { streamTextSteps } from '@oddkin/ai/stream';

export const sources = [
  {
    type: 'source',
    id: 'src-a',
    sourceId: 'a',
    title: 'Ocean heat content, 1955–2024',
    url: 'https://example.org/ocean-heat',
    publisher: 'Example Climate Data',
    excerpt: 'Upper-ocean heat content rose in every decade since 1990.',
  },
  {
    type: 'source',
    id: 'src-b',
    sourceId: 'b',
    title: 'Marine heatwaves review',
    url: 'https://example.org/marine-heatwaves',
    excerpt: 'Heatwave days doubled between 1982 and 2016.',
  },
];

const answer = `## Summary

Ocean warming is well documented [^a]. Marine heatwaves are becoming **more frequent** [^b], and one claim below has no source record [^c].

- Upper-ocean heat content rose each decade [^a]
- Heatwave days roughly doubled
  - largest increases in the North Pacific

| Period | Heatwave days |
|:--|--:|
| 1982–1999 | 18 |
| 2000–2016 | 37 |

\`\`\`py
# Simulated analysis snippet
trend = (37 - 18) / 18  # 105 % increase
print(f"{trend:.0%}")
\`\`\`

See the generated report artifact for details.`;

const report = (revision) => `# Ocean warming brief (revision ${revision})

1. Heat content is rising.
2. Heatwaves are more frequent.${revision > 1 ? '\n3. Coastal ecosystems are most exposed.' : ''}
`;

let counter = 0;

/** The simulated server's events for one attempt. `speed` is ms per chunk. */
export function researchScript(request, speed) {
  const n = ++counter;
  const prompt = request.prompt.parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join(' ')
    .toLowerCase();
  const tool = `search-${n}`;
  const steps = [
    { after: speed, event: { type: 'text-start', partId: `r-${n}`, kind: 'reasoning' } },
    {
      after: speed,
      event: {
        type: 'text-delta',
        partId: `r-${n}`,
        delta: 'I will search two datasets, then summarize.',
      },
    },
    { after: speed, event: { type: 'text-end', partId: `r-${n}` } },
    {
      after: speed,
      event: {
        type: 'tool-input-start',
        toolCallId: tool,
        toolName: 'searchDatasets',
        title: 'Search climate datasets',
      },
    },
    {
      after: speed,
      event: { type: 'tool-input-delta', toolCallId: tool, delta: '{"query":"ocean ' },
    },
    {
      after: speed,
      event: { type: 'tool-input-delta', toolCallId: tool, delta: 'warming","limit":2}' },
    },
    {
      after: speed,
      event: {
        type: 'tool-input-available',
        toolCallId: tool,
        input: { query: 'ocean warming', limit: 2 },
      },
    },
    { after: speed * 4, event: { type: 'tool-executing', toolCallId: tool } },
  ];
  if (prompt.includes('tool fail')) {
    steps.push({
      after: speed * 4,
      event: {
        type: 'tool-error',
        toolCallId: tool,
        error: { code: 'tool.timeout', message: 'The dataset service timed out (simulated).' },
      },
    });
    steps.push({
      after: speed,
      event: {
        type: 'error',
        error: {
          code: 'run.failed',
          message: 'The research run failed (simulated).',
          retryable: true,
        },
      },
    });
    return steps;
  }
  steps.push({
    after: speed * 4,
    event: {
      type: 'tool-output',
      toolCallId: tool,
      output: { results: 2, datasets: ['ocean-heat', 'marine-heatwaves'] },
    },
  });
  for (const source of sources)
    steps.push({
      after: speed,
      event: { type: 'part', part: { ...source, id: `${source.id}-${n}` } },
    });
  steps.push(...streamTextSteps(`answer-${n}`, answer, speed, 5));
  if (prompt.includes('drop'))
    return [...steps.slice(0, steps.length - 20), { after: speed, drop: true }];
  const revisions = Math.min(n, 3);
  steps.push({
    after: speed,
    event: {
      type: 'artifact',
      artifact: {
        artifactId: 'ocean-brief',
        title: 'Ocean warming brief',
        kind: 'markdown',
        currentRevisionId: `rev-${revisions}`,
        revisions: Array.from({ length: revisions }, (_, i) => ({
          revisionId: `rev-${i + 1}`,
          number: i + 1,
          content: report(i + 1),
        })),
      },
    },
  });
  steps.push({
    after: speed,
    event: {
      type: 'usage',
      usage: [
        { kind: 'input-tokens', label: 'Input', used: 812, unit: 'tokens', precision: 'measured' },
        {
          kind: 'output-tokens',
          label: 'Output',
          used: 356,
          unit: 'tokens',
          precision: 'measured',
        },
        {
          kind: 'context',
          label: 'Context window',
          used: 4096 + n * 1168,
          limit: 32000,
          unit: 'tokens',
          precision: 'estimated',
        },
        { kind: 'cost', label: 'Cost', precision: 'unknown' },
      ],
    },
  });
  steps.push({ after: speed, event: { type: 'finish' } });
  return steps;
}

const text = (id, value) => [{ type: 'text', id, text: value }];

export const initialConversation = {
  conversationId: 'research-1',
  hasMoreHistory: true,
  messages: [
    {
      id: 'h3',
      role: 'user',
      parentId: 'h2',
      parts: text('h3t', 'Which datasets do you trust for ocean heat?'),
    },
    {
      id: 'h4',
      role: 'assistant',
      parentId: 'h3',
      parts: text(
        'h4t',
        'Long-running, openly documented records with stated uncertainty (simulated).',
      ),
    },
  ],
};

export const historyPages = [
  {
    conversationId: 'research-1',
    messages: [
      { id: 'h1', role: 'user', parts: text('h1t', 'I am preparing a brief on ocean warming.') },
      {
        id: 'h2',
        role: 'assistant',
        parentId: 'h1',
        parts: text('h2t', 'Happy to help. Tell me the audience and length (simulated).'),
      },
    ],
  },
];

export const otherConversation = {
  conversationId: 'research-2',
  messages: [
    {
      id: 'o1',
      role: 'user',
      parts: text('o1t', 'A different conversation, loaded to show isolation.'),
    },
  ],
};

export const suggestions = [
  {
    id: 's1',
    label: 'Summarize ocean warming',
    prompt: 'Summarize recent ocean warming evidence with sources.',
  },
  { id: 's2', label: 'Make a tool fail', prompt: 'Run the search but make the tool fail.' },
  { id: 's3', label: 'Drop the connection', prompt: 'Answer, but drop the connection midway.' },
];

export const models = [
  {
    id: 'sim-fast',
    label: 'Simulated fast',
    description: 'Short answers.',
    capabilities: ['text', 'tools'],
    available: true,
  },
  {
    id: 'sim-deep',
    label: 'Simulated deep',
    description: 'Longer research.',
    capabilities: ['text', 'tools', 'artifacts'],
    available: true,
  },
  {
    id: 'sim-vision',
    label: 'Simulated vision',
    available: false,
    reason: 'Not available in this demo.',
  },
];
