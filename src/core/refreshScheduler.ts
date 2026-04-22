export interface RefreshIntervals {
  overviewMs: number;
  processMs: number;
  diskMs: number;
}

export class RefreshScheduler {
  private readonly intervals: RefreshIntervals;

  constructor(intervals: RefreshIntervals) {
    this.intervals = { ...intervals };
  }

  getIntervals(): RefreshIntervals {
    return { ...this.intervals };
  }
}
