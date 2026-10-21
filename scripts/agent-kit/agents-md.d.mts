import type { Project } from './context.mjs';

export const BEGIN: string;
export const END: string;
export function renderSection(project: Project): string;
export function updateAgentsMd(text: string, section: string): string;
export function lineDiff(before: string, after: string): string[];
export function main(argv?: string[]): Promise<number>;
