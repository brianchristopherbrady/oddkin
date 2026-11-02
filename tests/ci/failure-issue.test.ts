import { describe, expect, it } from 'vitest';
import {
  LABEL,
  report,
  type ReportContext,
  type ReportGitHub,
} from '../../scripts/ci/failure-issue.mjs';

// The workflows' failure issue (scripts/ci/failure-issue.mjs), against an in-memory repository
// shaped like the Octokit that actions/github-script passes.
interface Issue {
  number: number;
  title: string;
  state: string;
  labels: string[];
  body?: string;
  pull_request?: object;
  comments: string[];
}

function repository(jobs: unknown[] = []) {
  const issues: Issue[] = [];
  const labels = new Set<string>();
  const find = (params: Record<string, unknown>) =>
    issues.find((issue) => issue.number === params['issue_number'])!;
  const github: ReportGitHub = {
    paginate: async (method, params) => {
      const { data } = (await method(params)) as { data: unknown[] | { jobs: unknown[] } };
      return Array.isArray(data) ? data : data.jobs;
    },
    rest: {
      issues: {
        listForRepo: async (params) => ({
          data: issues.filter(
            (issue) =>
              issue.state === params['state'] && issue.labels.includes(`${params['labels']}`),
          ),
        }),
        createComment: async (params) => find(params).comments.push(`${params['body']}`),
        update: async (params) => (find(params).state = `${params['state']}`),
        getLabel: async (params) => {
          if (!labels.has(`${params['name']}`))
            throw Object.assign(new Error('Not Found'), { status: 404 });
        },
        createLabel: async (params) => labels.add(`${params['name']}`),
        create: async (params) =>
          issues.push({
            number: issues.length + 1,
            title: `${params['title']}`,
            state: 'open',
            labels: params['labels'] as string[],
            body: `${params['body']}`,
            comments: [],
          }),
      },
      actions: {
        listJobsForWorkflowRun: async () => ({ data: { total_count: jobs.length, jobs } }),
      },
    },
  };
  return { github, issues, labels };
}

const context = (runId: number, workflow = 'CI'): ReportContext => ({
  repo: { owner: 'o', repo: 'r' },
  workflow,
  runId,
  serverUrl: 'https://github.com',
  sha: 'abcdef1234567',
  eventName: 'push',
  ref: 'refs/heads/main',
});

describe('the failing-workflow issue', () => {
  it('opens one labelled issue for a failed run, naming the failed steps', async () => {
    const { github, issues, labels } = repository([
      {
        name: 'verify',
        conclusion: 'failure',
        steps: [
          { name: 'npm run lint', conclusion: 'success' },
          { name: 'npm run typecheck', conclusion: 'failure' },
        ],
      },
      { name: 'smoke', conclusion: 'failure', steps: [] },
      { name: 'report', conclusion: null },
    ]);
    expect(await report({ github, context: context(7), result: 'failure' })).toBe('opened');
    expect(labels).toEqual(new Set([LABEL]));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ title: 'Failing workflow: CI', labels: [LABEL] });
    expect(issues[0]!.body).toContain(
      '[Run 7](https://github.com/o/r/actions/runs/7) failed on `abcdef1` (push, refs/heads/main).',
    );
    expect(issues[0]!.body).toContain('Failed steps:\n- verify: npm run typecheck\n- smoke\n');
  });

  it('comments while the issue is open and closes it on the next passing run', async () => {
    const { github, issues } = repository([{ name: 'verify', conclusion: 'failure' }]);
    await report({ github, context: context(7), result: 'failure' });
    expect(await report({ github, context: context(8), result: 'failure' })).toBe('commented');
    expect(issues[0]!.comments[0]).toContain(
      '[Run 8](https://github.com/o/r/actions/runs/8) failed',
    );
    expect(await report({ github, context: context(9), result: 'success' })).toBe('closed');
    expect(issues[0]!.state).toBe('closed');
    expect(issues[0]!.comments[1]).toBe(
      'Passing again: [run 9](https://github.com/o/r/actions/runs/9) on `abcdef1`.',
    );
    expect(await report({ github, context: context(10), result: 'success' })).toBe('none');
    expect(issues).toHaveLength(1);
  });

  it('keeps to its own workflow, skips pull requests, and ignores other results', async () => {
    const { github, issues } = repository();
    issues.push({
      number: 1,
      title: 'Failing workflow: CI',
      state: 'open',
      labels: [LABEL],
      pull_request: {},
      comments: [],
    });
    await report({ github, context: context(7, 'Docs site'), result: 'failure' });
    expect(await report({ github, context: context(8), result: 'success' })).toBe('none');
    expect(await report({ github, context: context(9), result: 'cancelled' })).toBe('none');
    expect(issues.map((issue) => [issue.title, issue.state, issue.comments.length])).toEqual([
      ['Failing workflow: CI', 'open', 0],
      ['Failing workflow: Docs site', 'open', 0],
    ]);
  });
});
