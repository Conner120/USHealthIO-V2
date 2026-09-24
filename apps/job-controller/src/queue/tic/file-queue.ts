import { FileQueue } from "../file-queue";
import type { FileJob } from "@repo/queue";

export type { FileJob } from "@repo/queue";

/**
 * FileQueue specialised to TiC MRF jobs. Note `sizeBytes` is the *download* size
 * (usually compressed); the staging footprint is `stagingBytesFor(job)`.
 */
export class TicFileQueue extends FileQueue<FileJob> {}
