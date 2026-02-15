import axios from "axios";
import { FileExtension, FileType, InsurancePlanIdType, InsurancePlanMarketType, Prisma, prisma } from "@repo/database";
import type { TaskPayload } from "./taskRoot";
import { generateId, IDTYPE } from "@repo/id-gen";
import { makePlanHash } from "@repo/object-hash";
import { pub } from "..";

export async function importUnitedHealthcareData(data: TaskPayload, heartbeat?: () => Promise<void>) {
    const importSource = await prisma.insuranceScanSource.findUnique({
        where: {
            id: data.payload.id
        }
    });
    await prisma.insuranceScanJob.update({
        where: {
            id: data.id
        },
        data: {
            status: 'DOWNLOADING',
            statusTime: new Date(),
        }
    });
    if (!data.payload.options || !data.payload.options['united_blob_page_url']) {
        throw new Error("United Healthcare blob page URL is missing in options");
    }
    const indexResponse = await axios.get(data.payload.options['united_blob_page_url']);
    if (indexResponse.status !== 200) {
        throw new Error(`Failed to fetch United Healthcare data, status code: ${indexResponse.status}`);
    }
    const indexData: {
        name: string;
        downloadUrl: string;
        size: number;
    }[] = indexResponse.data.blobs.filter((blob: any) => blob.name.endsWith('_index.json')).map((blob: any) => ({
        name: blob.name,
        downloadUrl: blob.downloadUrl,
        size: blob.size,
    }));
    console.log(`Fetched index data with ${indexData.length} entries`);

    await prisma.insuranceScanJob.update({
        where: {
            id: data.id
        },
        data: {
            status: 'PARSING',
            statusTime: new Date(),
            fileUrl: data.payload.options['united_blob_page_url'],
        }
    });

    // Collect all file URLs across all blobs, deduplicating by location
    const filesToImport: {
        reportingPlans: string[],
        file: {
            url: string
            type: "in_network" | "allowed_amount"
        }
    }[] = [];
    let filesToImportIndex: { [key: string]: number } = {};

    // Collect all unique plans across all blobs for fallback lookups
    const allGoodPlans: any[] = [];

    // Download each blob's index file and extract reporting structures
    const blobConcurrency = 50;
    for (let blobIdx = 0; blobIdx < indexData.length; blobIdx += blobConcurrency) {
        const blobChunk = indexData.slice(blobIdx, blobIdx + blobConcurrency);
        const blobResults = await Promise.allSettled(
            blobChunk.map(blob => axios.get(blob.downloadUrl))
        );

        for (let i = 0; i < blobResults.length; i++) {
            const result = blobResults[i]!;
            const blob = blobChunk[i]!;
            if (result.status === 'rejected') {
                console.error(`Failed to fetch blob "${blob.name}":`, result.reason);
                continue;
            }
            const blobData = result.value.data;
            if (!blobData.reporting_structure || blobData.reporting_structure.length === 0) {
                continue;
            }

            // Collect unique plans from this blob for fallback
            const blobGoodPlans = blobData.reporting_structure
                .flatMap((rs: any) => rs.reporting_plans)
                .reduce((acc: any[], plan: any) => {
                    if (!acc.find((p: any) => p.plan_name === plan.plan_name) && plan.plan_id) {
                        acc.push(plan);
                    }
                    return acc;
                }, []);
            for (const plan of blobGoodPlans) {
                if (!allGoodPlans.find((p: any) => p.plan_name === plan.plan_name)) {
                    allGoodPlans.push(plan);
                }
            }

            for (const fileReport of blobData.reporting_structure) {
                let plans: string[] = [];

                if (fileReport.allowed_amount_file) {
                    plans = await getAndUpsertPlan(fileReport.reporting_plans, importSource?.insuranceCompanyId || "", allGoodPlans);
                    let locationSimple = fileReport.allowed_amount_file.location.split('?')[0];
                    let index = filesToImportIndex[locationSimple];
                    if (index !== undefined) {
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
                    if (plans.length === 0) {
                        plans = await getAndUpsertPlan(fileReport.reporting_plans, importSource?.insuranceCompanyId || "", allGoodPlans);
                    }
                    for (const inNetworkFile of fileReport.in_network_files) {
                        let locationSimple = inNetworkFile.location.split('?')[0];
                        let index = filesToImportIndex[locationSimple];
                        if (index !== undefined) {
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

        }
        console.log(`Processed blob chunk ${blobIdx + blobChunk.length}/${indexData.length}. Total unique files to import so far: ${filesToImport.length}.`);

        if (heartbeat) await heartbeat();
    }

    console.log(`Extracted ${allGoodPlans.length} unique plans across all blobs.`);
    console.log(`Found ${filesToImport.length} unique files to import (${filesToImport.filter(f => f.file.type === "in_network").length} in-network, ${filesToImport.filter(f => f.file.type === "allowed_amount").length} allowed-amount).`);

    // Deduplicate plan IDs within each file entry
    for (const entry of filesToImport) {
        entry.reportingPlans = [...new Set(entry.reportingPlans)];
    }

    // Dispatch jobs in chunks
    const chunkSize = 100;

    const inNetworkFiles = filesToImport.filter(f => f.file.type === "in_network");
    for (let i = 0; i < inNetworkFiles.length; i += chunkSize) {
        const chunk = inNetworkFiles.slice(i, i + chunkSize);
        const chunkDatabase: Prisma.InsuranceScanJobCreateManyInput[] = chunk.map(fileToImport => ({
            id: generateId(IDTYPE.INSURANCE_SCAN_JOB),
            insuranceScanSourceId: data.payload.id,
            status: 'PENDING',
            statusTime: new Date(),
            fileUrl: fileToImport.file.url,
            insurancePlanIds: fileToImport.reportingPlans,
            fileExtension: getFileExtensionFromUrlWithQuery(fileToImport.file.url),
            fileType: 'IN_NETWORK' as FileType,
            parentJobId: data.id,
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
        await Promise.all(chunkDatabase.map(fileToImport =>
            pub.send({ exchange: 'jobs' }, {
                id: fileToImport.id,
                type: 'in-network-file',
                payload: {
                    sourceType: 'UNITED_HEATHCARE_BLOB_API',
                    url: fileToImport.fileUrl!,
                    insuranceCompanyId: importSource?.insuranceCompanyId || null,
                    insuranceImportSourceId: importSource?.id || null,
                }
            })
        ));
        console.log(`Dispatched in-network-file chunk with ${chunk.length} files (${i + chunk.length}/${inNetworkFiles.length}).`);
    }

    const allowedAmountFiles = filesToImport.filter(f => f.file.type === "allowed_amount");
    for (let i = 0; i < allowedAmountFiles.length; i += chunkSize) {
        const chunk = allowedAmountFiles.slice(i, i + chunkSize);
        const chunkDatabase: Prisma.InsuranceScanJobCreateManyInput[] = chunk.map(fileToImport => ({
            id: generateId(IDTYPE.INSURANCE_SCAN_JOB),
            insuranceScanSourceId: data.payload.id,
            status: 'PENDING',
            statusTime: new Date(),
            fileUrl: fileToImport.file.url,
            fileExtension: getFileExtensionFromUrlWithQuery(fileToImport.file.url),
            fileType: 'ALLOWED_AMOUNT' as FileType,
            insurancePlanIds: fileToImport.reportingPlans,
            parentJobId: data.id,
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
        await Promise.all(chunkDatabase.map(fileToImport =>
            pub.send({ exchange: 'jobs' }, {
                id: fileToImport.id,
                type: 'allowed-amount-file',
                payload: {
                    sourceType: 'UNITED_HEATHCARE_BLOB_API',
                    url: fileToImport.fileUrl!,
                    insuranceCompanyId: importSource?.insuranceCompanyId || null,
                    insuranceImportSourceId: importSource?.id || null,
                }
            })
        ));
        console.log(`Dispatched allowed-amount chunk with ${chunk.length} files (${i + chunk.length}/${allowedAmountFiles.length}).`);
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
    console.log("All United Healthcare files dispatched for import.");
}

async function getAndUpsertPlan(planData: {
    plan_name: string,
    plan_id_type: 'ein' | 'hios'
    plan_id: string
    plan_sponsor_name: string
    plan_market_type: 'individual' | 'group'
}[], insurance_company_id: string, plansBackup: {
    plan_name: string,
    plan_id_type: 'ein' | 'hios'
    plan_id: string
    plan_sponsor_name: string
    plan_market_type: 'individual' | 'group'
}[]
): Promise<string[]> {
    const preparedPlanData = planData.map(plan => {
        if (plan.plan_id) {
            return {
                id: generateId(IDTYPE.INSURANCE_PLAN),
                insuranceCompanyId: insurance_company_id,
                planName: plan.plan_name,
                planIdType: plan.plan_id_type === 'ein' ? InsurancePlanIdType.EIN : InsurancePlanIdType.HIOS,
                planId: plan.plan_id,
                planSponsorName: plan.plan_sponsor_name,
                planMarketType: plan.plan_market_type === 'individual' ? InsurancePlanMarketType.INDIVIDUAL : InsurancePlanMarketType.GROUP,
                insurancePlanHash: makePlanHash(
                    insurance_company_id,
                    plan.plan_market_type === 'individual' ? InsurancePlanMarketType.INDIVIDUAL : InsurancePlanMarketType.GROUP,
                    plan.plan_name,
                    plan.plan_id_type.toUpperCase(),
                    plan.plan_id,
                )
            }
        } else {
            const goodPlan = plansBackup.find(p => p.plan_name === plan.plan_name);
            if (goodPlan) {
                return {
                    id: generateId(IDTYPE.INSURANCE_PLAN),
                    insuranceCompanyId: insurance_company_id,
                    planName: goodPlan.plan_name,
                    planIdType: goodPlan.plan_id_type === 'ein' ? InsurancePlanIdType.EIN : InsurancePlanIdType.HIOS,
                    planId: goodPlan.plan_id,
                    planSponsorName: goodPlan.plan_sponsor_name,
                    planMarketType: goodPlan.plan_market_type === 'individual' ? InsurancePlanMarketType.INDIVIDUAL : InsurancePlanMarketType.GROUP,
                    insurancePlanHash: makePlanHash(
                        goodPlan.plan_id,
                        goodPlan.plan_market_type === 'individual' ? InsurancePlanMarketType.INDIVIDUAL : InsurancePlanMarketType.GROUP,
                        goodPlan.plan_name,
                        goodPlan.plan_id_type.toUpperCase(),
                        insurance_company_id,
                    )
                }
            } else {
                return null;
            }
        }
    }).filter(p => p !== null) as {
        insuranceCompanyId: string,
        planName: string,
        planIdType: InsurancePlanIdType,
        planId: string,
        planSponsorName: string,
        planMarketType: InsurancePlanMarketType,
        insurancePlanHash: string
    }[];
    if (preparedPlanData.length === 0) {
        return [];
    }
    const existingPlans = await prisma.insurancePlan.findMany({
        where: {
            insurancePlanHash: {
                in: preparedPlanData.map(p => p.insurancePlanHash)
            }
        },
        select: { id: true, insurancePlanHash: true }
    });
    await prisma.insurancePlan.updateMany({
        where: {
            id: {
                in: existingPlans.map(p => p.id)
            }
        },
        data: {
            planLastSeen: new Date(),
        }
    });
    if (existingPlans.length === preparedPlanData.length) {
        return existingPlans.map(p => p.id);
    }
    const newPlansData = preparedPlanData.filter(p => !existingPlans.find(ep => ep.insurancePlanHash === p.insurancePlanHash)).map(p => ({
        id: generateId(IDTYPE.INSURANCE_PLAN),
        insuranceCompanyId: p.insuranceCompanyId,
        planName: p.planName,
        planIdType: p.planIdType,
        planId: p.planId,
        planMarketType: p.planMarketType,
        planFirstSeen: new Date(),
        planLastSeen: new Date(),
        insurancePlanHash: p.insurancePlanHash,
        createdBy: 'HDAS_UHC_IMPORT',
        updatedBy: 'HDAS_UHC_IMPORT',
    }));
    await prisma.insurancePlan.createMany({
        data: newPlansData
    });
    return [
        ...existingPlans.map(p => p.id),
        ...newPlansData.map(p => p.id)
    ]
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
