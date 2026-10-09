import { describe, expect, it } from 'vitest';
import type { Step } from './timeline';
import { Timeline } from './timeline';

function recorder(name: string, duration: number, log: string[]): Step {
  return {
    duration,
    begin: () => log.push(`${name} begin`),
    update: (progress) => log.push(`${name} ${progress.toFixed(2)}`),
    end: () => log.push(`${name} end`),
  };
}

describe('Timeline', () => {
  it('plays steps one after another', () => {
    const log: string[] = [];
    const timeline = new Timeline();
    timeline.enqueue(recorder('a', 1, log), recorder('b', 1, log));

    timeline.update(0.5);
    expect(log).toEqual(['a begin', 'a 0.50']);
    expect(timeline.idle).toBe(false);

    timeline.update(1);
    expect(log.slice(2)).toEqual(['a 1.00', 'a end', 'b begin', 'b 0.50']);

    timeline.update(0.5);
    expect(log.slice(6)).toEqual(['b 1.00', 'b end']);
    expect(timeline.idle).toBe(true);
  });

  it('runs steps without a duration at once', () => {
    const log: string[] = [];
    const timeline = new Timeline();
    timeline.enqueue(recorder('a', 0, log), recorder('b', 0, log));

    timeline.update(0);

    expect(log).toEqual(['a begin', 'a 1.00', 'a end', 'b begin', 'b 1.00', 'b end']);
  });

  it('finishes everything queued, beginning and ending each step once', () => {
    const log: string[] = [];
    const timeline = new Timeline();
    timeline.enqueue(recorder('a', 1, log), recorder('b', 1, log));
    timeline.update(0.25);

    timeline.finish();

    expect(log).toEqual(['a begin', 'a 0.25', 'a 1.00', 'a end', 'b begin', 'b 1.00', 'b end']);
    expect(timeline.idle).toBe(true);
  });
});
