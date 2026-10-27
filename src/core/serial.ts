export class FileQueue {
  private readonly pending = new Map<string, Promise<void>>();

  async run<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(key) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    const settled = result.then(
      () => undefined,
      () => undefined,
    );
    this.pending.set(key, settled);
    try {
      return await result;
    } finally {
      if (this.pending.get(key) === settled) this.pending.delete(key);
    }
  }
}

export class SwitchQueue {
  private generation = 0;
  private readonly queue = new FileQueue();

  cancel(): void {
    this.generation += 1;
  }

  async run(operation: (current: () => boolean) => Promise<void>): Promise<void> {
    const generation = ++this.generation;
    await this.queue.run("workspace", async () => {
      const current = (): boolean => this.generation === generation;
      if (current()) await operation(current);
    });
  }
}
