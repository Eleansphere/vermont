/** One piece of an animation; the steps of a timeline play one after another. */
export interface Step {
  /** Seconds the step takes; 0 for something that just happens. */
  readonly duration: number;
  /** Called once when the step's turn comes. */
  begin?(): void;
  /** Called while the step plays, with its progress from 0 to 1. */
  update?(progress: number): void;
  /** Called once when the step is over, also when it is skipped. */
  end?(): void;
}

/** Plays queued steps in order. Time is passed in, so nothing here depends on a clock. */
export class Timeline {
  private readonly queue: Step[] = [];
  private elapsed = 0;
  private begun = false;

  get idle(): boolean {
    return this.queue.length === 0;
  }

  enqueue(...steps: readonly Step[]): void {
    this.queue.push(...steps);
  }

  /** Moves the animation forward by `seconds`, through as many steps as fit into them. */
  update(seconds: number): void {
    let remaining = seconds;
    for (let step = this.queue[0]; step; step = this.queue[0]) {
      if (!this.begun) {
        this.begun = true;
        step.begin?.();
      }
      const left = step.duration - this.elapsed;
      if (remaining < left) {
        this.elapsed += remaining;
        step.update?.(this.elapsed / step.duration);
        return;
      }
      remaining -= left;
      this.complete(step);
    }
  }

  /** Jumps to the end of everything queued; every step still begins and ends. */
  finish(): void {
    for (let step = this.queue[0]; step; step = this.queue[0]) {
      if (!this.begun) step.begin?.();
      this.complete(step);
    }
  }

  private complete(step: Step): void {
    step.update?.(1);
    step.end?.();
    this.queue.shift();
    this.elapsed = 0;
    this.begun = false;
  }
}
