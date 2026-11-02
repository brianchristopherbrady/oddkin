export declare const LABEL: 'ci-failure';

type Params = Record<string, unknown>;
type Method = (params: Params) => Promise<unknown>;

/** The parts of actions/github-script's `github` (an Octokit) that `report` uses. */
export interface ReportGitHub {
  paginate(method: Method, params: Params): Promise<unknown[]>;
  rest: {
    issues: Record<
      'listForRepo' | 'createComment' | 'update' | 'getLabel' | 'createLabel' | 'create',
      Method
    >;
    actions: Record<'listJobsForWorkflowRun', Method>;
  };
}

/** The parts of actions/github-script's `context` that `report` uses. */
export interface ReportContext {
  repo: { owner: string; repo: string };
  workflow: string;
  runId: number;
  serverUrl: string;
  sha: string;
  eventName: string;
  ref: string;
}

export declare function report(options: {
  github: ReportGitHub;
  context: ReportContext;
  /** `failure` or `success`; anything else does nothing. */
  result: string;
}): Promise<'opened' | 'commented' | 'closed' | 'none'>;
