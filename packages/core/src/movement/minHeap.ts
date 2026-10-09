interface HeapEntry<T> {
  readonly item: T;
  readonly priority: number;
  /** Insertion order; breaks ties so that results do not depend on heap internals. */
  readonly order: number;
}

/** Priority queue that returns the lowest priority first, and the earliest pushed among equals. */
export class MinHeap<T> {
  private readonly entries: HeapEntry<T>[] = [];
  private pushed = 0;

  get size(): number {
    return this.entries.length;
  }

  push(item: T, priority: number): void {
    this.entries.push({ item, priority, order: this.pushed++ });
    this.siftUp(this.entries.length - 1);
  }

  pop(): T | undefined {
    const top = this.entries[0];
    const last = this.entries.pop();
    if (top === undefined || last === undefined) return undefined;
    if (this.entries.length > 0) {
      this.entries[0] = last;
      this.siftDown(0);
    }
    return top.item;
  }

  private siftUp(start: number): void {
    let index = start;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!this.isBefore(index, parent)) return;
      this.swap(index, parent);
      index = parent;
    }
  }

  private siftDown(start: number): void {
    let index = start;
    for (;;) {
      const left = 2 * index + 1;
      const right = left + 1;
      let first = index;
      if (left < this.entries.length && this.isBefore(left, first)) first = left;
      if (right < this.entries.length && this.isBefore(right, first)) first = right;
      if (first === index) return;
      this.swap(index, first);
      index = first;
    }
  }

  private isBefore(a: number, b: number): boolean {
    const entryA = this.entries[a]!;
    const entryB = this.entries[b]!;
    if (entryA.priority !== entryB.priority) return entryA.priority < entryB.priority;
    return entryA.order < entryB.order;
  }

  private swap(a: number, b: number): void {
    const entryA = this.entries[a]!;
    this.entries[a] = this.entries[b]!;
    this.entries[b] = entryA;
  }
}
