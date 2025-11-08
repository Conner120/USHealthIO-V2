import { createId } from "@paralleldrive/cuid2";

export function generateId(type: IDTYPE): string {
    return `${type}_${createId()}`;
}

export enum IDTYPE {
    INSURANCE_COMPANY = "ins",
    INSURANCE_SCAN_SOURCE = "iss",
    INSURANCE_SCAN_JOB = "ins_job",
    INSURANCE_SCAN_FILE = "ins_file",
    INSURANCE_SCAN_STEP = "ins_step"
}
