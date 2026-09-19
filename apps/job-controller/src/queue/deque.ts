import { deque, take, ack, nack, type Owned } from "@repo/queue";

/**
 * Generic Redis-backed deque with ownership. FileQueue and TaskQueue build on
 * this; the Redis ops live in @repo/queue.
 *
 *   push / pushFront / pop / peek   plain list ops
 *   take → ack | nack               reliable: a taken item sits in
 *                                   {key}:inflight under this node until acked
 */
export abstract class Deque<T extends Owned> {
  /** Redis key holding this deque. */
  abstract readonly key: string;

  push(item: T): Promise<void> {
    return deque.pushBack(this.key, item);
  }

  pushFront(item: T): Promise<void> {
    return deque.pushFront(this.key, item);
  }

  pop(): Promise<T | null> {
    return deque.popFront<T>(this.key);
  }

  peek(): Promise<T | null> {
    return deque.peekFront<T>(this.key);
  }

  size(): Promise<number> {
    return deque.length(this.key);
  }

  clear(): Promise<void> {
    return deque.clear(this.key);
  }

  /** Non-destructive view of the first `n` items. */
  list(n = 100): Promise<T[]> {
    return deque.range<T>(this.key, 0, n - 1);
  }

  /** Pop the head and own it until ack/nack. Dies with us → reaper reassigns. */
  take(): Promise<T | null> {
    return take<T>(this.key);
  }

  /** Done with it (any outcome). */
  ack(item: T): Promise<void> {
    return ack(this.key, item.id);
  }

  /** Give it back to the head, e.g. no room right now. */
  nack(item: T): Promise<boolean> {
    return nack(this.key, item);
  }
}
