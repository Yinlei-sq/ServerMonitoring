export interface NetworkSample {
  rx: number;
  tx: number;
  at?: number;
}

export interface NetworkRate {
  rxBytesPerSecond: number;
  txBytesPerSecond: number;
}

export class NetworkRateTracker {
  private previous?: Required<NetworkSample>;

  next(sample: NetworkSample): NetworkRate {
    const current = {
      rx: sample.rx,
      tx: sample.tx,
      at: sample.at ?? Date.now()
    };

    if (!this.previous) {
      this.previous = current;
      return {
        rxBytesPerSecond: 0,
        txBytesPerSecond: 0
      };
    }

    const elapsedSeconds = Math.max((current.at - this.previous.at) / 1000, 0.001);
    const rxBytesPerSecond = Math.max((current.rx - this.previous.rx) / elapsedSeconds, 0);
    const txBytesPerSecond = Math.max((current.tx - this.previous.tx) / elapsedSeconds, 0);
    this.previous = current;

    return {
      rxBytesPerSecond,
      txBytesPerSecond
    };
  }

  reset(): void {
    this.previous = undefined;
  }
}
