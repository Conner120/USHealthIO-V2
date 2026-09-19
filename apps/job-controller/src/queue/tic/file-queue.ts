import { FileQueue } from "../file-queue";
import type { FileJob } from "@repo/queue";

export type { FileJob } from "@repo/queue";

/** FileQueue specialised to TiC MRF jobs. */
export class TicFileQueue extends FileQueue<FileJob> {}
