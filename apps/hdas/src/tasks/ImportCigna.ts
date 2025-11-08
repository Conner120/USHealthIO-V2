import axios from "axios";
import fs from "fs";
import { producer } from "..";
import { FileExtension, FileType, Prisma, prisma } from "@repo/database";
import type { TaskPayload } from "./taskRoot";
import { generateId, IDTYPE } from "@repo/id-gen";
export async function importCignaData(data: TaskPayload, heartbeat?: () => Promise<void>) {
    console.log("Updating job status to DOWNLOADING", data);
    await prisma.insuranceScanJob.update({
        where: {
            id: data.id
        },
        data: {
            status: 'DOWNLOADING',
            statusTime: new Date(),
        }
    });
    if (!data.payload.options || !data.payload.options['cigna_page_url']) {
        throw new Error("Cigna page URL is missing in options");
    }
    const blobs = await axios.get(data.payload.options['cigna_page_url']);
    if (blobs.status !== 200) {
        throw new Error(`Failed to fetch Cigna data, status code: ${blobs.status}`);
    }
    if (blobs.data.mrfs.length === 0) {
        console.log("No MRFs found in the Cigna data.");
        return;
    }
    if (blobs.data.mrfs.length !== 1) {
        console.warn(`Expected 1 MRF, but found ${blobs.data.mrfs.length}. Proceeding with the first one.`);
        return;
    }
    await prisma.insuranceScanJob.update({
        where: {
            id: data.id
        },
        data: {
            status: 'PARSING',
            statusTime: new Date(),
        }
    });
    // Process the first MRF (Medical Record File)
    const mrf = blobs.data.mrfs[0];
    // Here you would add logic to store the MRF in your database or further process it
    if (mrf.files.length !== 1) {
        console.warn(`Expected 1 file in MRF, but found ${mrf.files.length}.`);
        return;
    }
    const file = mrf.files[0].url;
    const indexFile = await axios.get(file);
    await prisma.insuranceScanJob.update({
        where: {
            id: data.id
        },
        data: {
            fileUrl: file,
            fileExtension: getFileExtensionFromUrlWithQuery(file),
        }
    });
    if (indexFile.status !== 200) {
        throw new Error(`Failed to fetch Cigna MRF file, status code: ${indexFile.status}`);
    }
    const filesToImport: {
        reportingPlans: string[],
        file: {
            url: string
            type: "in_network" | "allowed_amount"
        }
    }[] = [];
    let filesToImportIndex: { [key: string]: number } = {};
    for (const fileReport of indexFile.data.reporting_structure) {
        let plans: string[] = await getAndUpsertPlan(fileReport.reporting_plans);
        //parse allowed amount files
        if (fileReport.allowed_amount_file) {
            if (fileReport.allowed_amount_file.location.includes('cigna-health-life-insurance-company_empty_allowed-amounts.json')) {
                continue;
            }
            let locationSimple = fileReport.allowed_amount_file.location.split('?')[0];
            let index = filesToImportIndex[locationSimple];
            if (index) {
                filesToImport[index]!.reportingPlans.push(...plans);
            } else {
                filesToImport.push({
                    reportingPlans: plans,
                    file: {
                        url: fileReport.allowed_amount_file.location,
                        type: "allowed_amount"
                    }
                });
                filesToImportIndex[locationSimple] = filesToImport.length - 1;
            }
        }
        if (fileReport.in_network_files) {
            for (const inNetworkFile of fileReport.in_network_files) {
                let locationSimple = inNetworkFile.location.split('?')[0];
                let index = filesToImportIndex[locationSimple]
                if (index) {
                    filesToImport[index]!.reportingPlans.push(...plans);
                } else {
                    filesToImport.push({
                        reportingPlans: plans,
                        file: {
                            url: inNetworkFile.location,
                            type: "in_network"
                        }
                    });
                    filesToImportIndex[locationSimple] = filesToImport.length - 1;
                }
            }
        }
    }
    // split into chunks of 100
    const chunkSize = 100;
    for (let i = 0; i < filesToImport.filter(f => f.file.type === "in_network").length; i += chunkSize) {
        const chunk = filesToImport.filter(f => f.file.type === "in_network").slice(i, i + chunkSize);
        const chunkDatabase: Prisma.InsuranceScanJobCreateManyInput[] = chunk.map(fileToImport => ({
            id: generateId(IDTYPE.INSURANCE_SCAN_JOB),
            insuranceScanSourceId: data.payload.id,
            status: 'PENDING',
            statusTime: new Date(),
            fileUrl: fileToImport.file.url,
            fileExtension: getFileExtensionFromUrlWithQuery(fileToImport.file.url),
            fileType: 'IN_NETWORK' as FileType,
            insuranceScanJobId: data.id,
            createdBy: data.payload.createdBy,
            updatedBy: data.payload.createdBy,
        }));
        await prisma.insuranceScanJob.createMany({
            data: chunkDatabase
        });
        if (process.env.BLOCK_IN_NETWORK_IMPORTS === "1") {
            console.log("Blocking in-network imports as per environment variable.");
            continue;
        }
        await producer.send({
            topic: `${process.env.KAFKA_PREFIX}in-network-file`,
            messages: chunkDatabase.map(fileToImport => ({
                value: JSON.stringify({
                    id: fileToImport.id,
                    topic: 'in-network-file',
                    payload: {
                        sourceType: 'CIGNA_INDEX_API',
                        url: fileToImport.fileUrl!,
                        reportingPlans: filesToImport.find(f => f.file.url === fileToImport.fileUrl!)?.reportingPlans || [],
                    }
                }),
            })),
        });
        console.log(`Dispatched in-network-file chunk with ${chunk.length} files.`);
    }
    for (let i = 0; i < filesToImport.filter(f => f.file.type === "allowed_amount").length; i += chunkSize) {
        const chunk = filesToImport.filter(f => f.file.type === "allowed_amount").slice(i, i + chunkSize);
        const chunkDatabase: Prisma.InsuranceScanJobCreateManyInput[] = chunk.map(fileToImport => ({
            id: generateId(IDTYPE.INSURANCE_SCAN_JOB),
            insuranceScanSourceId: data.payload.id,
            status: 'PENDING',
            statusTime: new Date(),
            fileUrl: fileToImport.file.url,
            fileExtension: getFileExtensionFromUrlWithQuery(fileToImport.file.url),
            fileType: 'ALLOWED_AMOUNT' as FileType,
            insuranceScanJobId: data.id,
            createdBy: data.payload.createdBy,
            updatedBy: data.payload.createdBy,
        }));
        await prisma.insuranceScanJob.createMany({
            data: chunkDatabase
        });
        if (process.env.BLOCK_ALLOWED_AMOUNT_IMPORTS === "1") {
            console.log("Blocking allowed-amount imports as per environment variable.");
            continue;
        }
        await producer.send({
            topic: `${process.env.KAFKA_PREFIX}allowed-amount`,
            messages: chunkDatabase.map(fileToImport => ({
                value: JSON.stringify({
                    id: fileToImport.id,
                    topic: 'allowed-amount',
                    payload: {
                        sourceType: 'CIGNA_INDEX_API',
                        url: fileToImport.fileUrl!,
                        reportingPlans: filesToImport.find(f => f.file.url === fileToImport.fileUrl!)?.reportingPlans || [],
                    }
                }),
            })),
        });
        console.log(`Dispatched allowed-amount chunk with ${chunk.length} files.`);
    }
    await prisma.insuranceScanJob.update({
        where: {
            id: data.id
        },
        data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            statusTime: new Date(),
        }
    });
    console.log("All files dispatched for import.");
}

async function getAndUpsertPlan(planData: {
    plan_name: string,
    plan_id_type: 'ein',
    plan_id: string
    plan_market_type: 'individual' | 'group' | 'medicare' | 'medicaid'
}[]): Promise<string[]> {
    // console.log("Upserting plans:", planData);
    return []
}

function getFileExtensionFromUrlWithQuery(url: string): FileExtension {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const ext = pathname.split('.').pop()!.split('?')[0]!.toLowerCase();
    switch (ext) {
        case 'gz':
        case 'gzip':
            return FileExtension.GZ;
        case 'zip':
            return FileExtension.ZIP;
        case 'json':
            return FileExtension.JSON;
    }
    return FileExtension.UNKNOWN;
}