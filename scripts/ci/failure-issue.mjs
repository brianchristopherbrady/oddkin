// The issue that tracks one workflow's failures, called from ci.yml, docs.yml, and
// registry-smoke.yml through actions/github-script. A failed run opens "Failing workflow: <name>"
// with its failed steps, or comments on it while it is open; the next passing run comments and
// closes it. The workflows leave pull requests out: their checks show in the pull request.

export const LABEL = 'ci-failure';

/** The open issue for this workflow, if any (the label's issues include pull requests). */
async function openIssue(github, owner, repo, title) {
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    state: 'open',
    labels: LABEL,
    per_page: 100,
  });
  return issues.find((issue) => issue.title === title && !issue.pull_request);
}

/** `job: step` for each failed step of the run, or the job alone when no step is marked. */
async function failedSteps(github, owner, repo, runId) {
  const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
    owner,
    repo,
    run_id: runId,
    per_page: 100,
  });
  return jobs
    .filter((job) => job.conclusion === 'failure')
    .flatMap((job) => {
      const steps = (job.steps ?? []).filter((step) => step.conclusion === 'failure');
      return steps.length ? steps.map((step) => `- ${job.name}: ${step.name}`) : [`- ${job.name}`];
    });
}

async function ensureLabel(github, owner, repo) {
  try {
    await github.rest.issues.getLabel({ owner, repo, name: LABEL });
  } catch (error) {
    if (error?.status !== 404) throw error;
    await github.rest.issues.createLabel({
      owner,
      repo,
      name: LABEL,
      color: 'b60205',
      description: 'A workflow fails outside a pull request',
    });
  }
}

/** Opens, comments on, or closes the workflow's issue for a run whose result is given. */
export async function report({ github, context, result }) {
  if (result !== 'failure' && result !== 'success') return 'none';
  const { owner, repo } = context.repo;
  const title = `Failing workflow: ${context.workflow}`;
  const url = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  const commit = `\`${context.sha.slice(0, 7)}\``;
  const open = await openIssue(github, owner, repo, title);

  if (result === 'success') {
    if (!open) return 'none';
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: open.number,
      body: `Passing again: [run ${context.runId}](${url}) on ${commit}.`,
    });
    await github.rest.issues.update({
      owner,
      repo,
      issue_number: open.number,
      state: 'closed',
      state_reason: 'completed',
    });
    return 'closed';
  }

  const steps = await failedSteps(github, owner, repo, context.runId);
  const body = [
    `[Run ${context.runId}](${url}) failed on ${commit} (${context.eventName}, ${context.ref}).`,
    '',
    ...(steps.length ? ['Failed steps:', ...steps] : ['No failed step was reported; see the run.']),
  ].join('\n');
  if (open) {
    await github.rest.issues.createComment({ owner, repo, issue_number: open.number, body });
    return 'commented';
  }
  await ensureLabel(github, owner, repo);
  await github.rest.issues.create({
    owner,
    repo,
    title,
    labels: [LABEL],
    body: `${body}\n\nThis issue stays open while the workflow fails; its next passing run closes it.`,
  });
  return 'opened';
}
