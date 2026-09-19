"use server"
import {prisma} from "@repo/database";
import {generateId, IDTYPE} from "@repo/id-gen";
import {withAuth} from "@workos-inc/authkit-nextjs";
import {Connection} from 'rabbitmq-client'

console.log(process.env);
// Initialize:
const rabbit = new Connection(`amqp://${process.env.RABBITMQ_USER || "guest"}:${process.env.RABBITMQ_PASSWORD || "guest"}@${process.env.RABBITMQ_HOST || "localhost"}:5672`)
rabbit.on('error', (err) => {
    console.log('RabbitMQ connection error', err)
})
rabbit.on('connection', () => {
    console.log('Connection successfully (re)established')
})
const pub = rabbit.createPublisher({
    // Enable publish confirmations, similar to consumer acknowledgements
    confirm: true,
    // Enable retries
    maxAttempts: 2,
    // Optionally ensure the existence of an exchange before we use it
    exchanges: [{exchange: 'jobs', type: 'direct'}],
})

export type NpiFileInfo = { filename: string; url: string; type: 'full' | 'weekly' };

async function scrapeNpiFiles(): Promise<NpiFileInfo[]> {
    const response = await fetch("https://download.cms.gov/nppes/NPI_Files.html");
    if (!response.ok) {
        throw new Error(`Failed to fetch CMS NPI page: ${response.status}`);
    }
    const html = await response.text();
    const linkPattern = /href=['"]\.?\/?([^'"]*NPPES_Data_Dissemination_[^'"]*\.zip)['"]/g;
    const files: NpiFileInfo[] = [];
    let match;
    while ((match = linkPattern.exec(html)) !== null) {
        const filename = match[1];
        const isWeekly = filename.includes('Weekly');
        files.push({
            filename,
            url: `https://download.cms.gov/nppes/${filename}`,
            type: isWeekly ? 'weekly' : 'full',
        });
    }
    if (files.length === 0) {
        throw new Error("Could not find any NPI data file URLs on CMS page");
    }
    return files;
}

export async function fetchNpiFiles(): Promise<NpiFileInfo[]> {
    await withAuth({ensureSignedIn: true});
    return scrapeNpiFiles();
}

export async function triggerNpiImport(urls: string[]): Promise<{ jobs: { jobId: string; fileUrl: string }[] }> {
    const {user} = await withAuth({ensureSignedIn: true});
    const jobs: { jobId: string; fileUrl: string }[] = [];
    for (const fileUrl of urls) {
        const scanJob = await prisma.insuranceScanJob.create({
            data: {
                id: generateId(IDTYPE.INSURANCE_SCAN_JOB),
                status: 'PENDING',
                fileUrl: fileUrl,
                statusTime: new Date(),
                createdBy: user?.id as string,
                updatedBy: user?.id as string,
            }
        });
        console.log('Publishing NPI Import Trigger for scan job', scanJob.id);
        await pub.send({
            exchange: 'jobs',
        }, {
            id: scanJob.id,
            type: 'provider-file',
            payload: {url: fileUrl}
        });
        jobs.push({jobId: scanJob.id, fileUrl});
    }
    return {jobs};
}

export async function SendTICJobTrigger(id: string, jobId: string) {
    const {user} = await withAuth({ensureSignedIn: true});
    const importSource = await prisma.insuranceScanSource.findFirst(
        {
            where: {
                id
            }
        }
    );
    if (!importSource) {
        return Error("Import source not found")
    }
    const scanJob = await prisma.insuranceScanJob.create({
        data: {
            id: generateId(IDTYPE.INSURANCE_SCAN_JOB),
            insuranceScanSourceId: importSource.id,
            status: 'PENDING',
            fileType: 'TABLE_OF_CONTENTS',
            statusTime: new Date(),
            createdBy: user?.id as string,
            updatedBy: user?.id as string,
        }
    })
    console.log('Publishing TIC Job Trigger for scan job', scanJob.id);
    await pub.send({
        exchange: 'jobs',
    }, {
        id: scanJob.id,
        type: 'insurance-source-scan-jobs',
        payload: importSource
    });
}