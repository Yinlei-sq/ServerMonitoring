import type { ModuleStatus } from './types.ts';

export type CollectorErrorKind = Exclude<ModuleStatus, 'ok'>;

export class CollectorError extends Error {
  constructor(
    message: string,
    public readonly kind: CollectorErrorKind
  ) {
    super(message);
    this.name = 'CollectorError';
  }
}
