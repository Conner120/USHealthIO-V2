import axios from "axios";
import fs from "fs";
import { producer } from "..";
import { FileExtension, FileType, InsurancePlanIdType, InsurancePlanMarketType, Prisma, prisma } from "@repo/database";
import type { TaskPayload } from "./taskRoot";
import { generateId, IDTYPE } from "@repo/id-gen";
import { makePlanHash } from "@repo/object-hash";
export async function importCignaData(data: TaskPayload, heartbeat?: () => Promise<void>) {
    console.log("Updating job status to DOWNLOADING", data);
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
        throw new Error("MRF does not contain exactly one file.");
    }
    const file = mrf.files[0].url;
    const indexFile = await axios.get(file);
    const goodPlans = indexFile.data.reporting_structure.flatMap((rs: any) => rs.reporting_plans).reduce((acc: any[], plan: any) => {
        if (!acc.find(p => p.plan_name === plan.plan_name) && plan.plan_id) {
            acc.push(plan);
        }
        return acc;
    }, []);
    if (goodPlans.length === 0) {
        console.error("No reporting plans found in the Cigna MRF index file.");
        throw new Error("No reporting plans found in the Cigna MRF index file.");
    }
    // write good plans to disk
    const goodPlansFilePath = `/tmp/good_plans_${data.id}.json`;
    fs.writeFileSync(goodPlansFilePath, JSON.stringify(goodPlans, null, 2));
    console.log(`Extracted ${goodPlans.length} unique plans from the Cigna MRF index file.`);
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
        let plans: string[] = [];
        //parse allowed amount files
        if (fileReport.allowed_amount_file) {
            if (fileReport.allowed_amount_file.location.includes('cigna-health-life-insurance-company_empty_allowed-amounts.json')) {
                continue;
            }
            plans = await getAndUpsertPlan(fileReport.reporting_plans, importSource?.insuranceCompanyId || "", goodPlans);
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
            if (plans.length === 0) {
                plans = await getAndUpsertPlan(fileReport.reporting_plans, importSource?.insuranceCompanyId || "", goodPlans);
            }
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
                        insuranceCompanyId: importSource?.insuranceCompanyId || null,
                        insuranceImportSourceId: importSource?.id || null,
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
                        insuranceCompanyId: importSource?.insuranceCompanyId || null,
                        insuranceImportSourceId: importSource?.id || null,
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
    console.log("Prepared plan data for upsert:", preparedPlanData.map(p => p.insurancePlanHash));
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
        createdBy: 'HDAS_CIGNA_IMPORT',
        updatedBy: 'HDAS_CIGNA_IMPORT',
    }));
    await prisma.insurancePlan.createMany({
        data: newPlansData
    });
    const allPlans = await prisma.insurancePlan.findMany({
        where: {
            insuranceCompanyId: insurance_company_id
        }
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