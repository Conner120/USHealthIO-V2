import { createId } from "@paralleldrive/cuid2";
import fs from "fs";
import { $, sleep } from "bun";
import { FileExtension, FileType, prisma } from "@repo/database";
import { generateId, IDTYPE } from "@repo/id-gen";
import process from "node:process";

const shardId = (process.env.HOSTNAME ?? "").split("-").pop() || process.env.SHARD_ID || 0
const workDir = process.env.WORK_DIR || "/tmp"
console.log(shardId)

export async function getFile(url: string, jobId: string): Promise<{
    size: number;
    success: boolean;
    message?: string;
}> {
    await prisma.insuranceScanJob.update({
        where: {
            id: jobId
        },
        data: {
            status: 'DOWNLOADING',
            statusTime: new Date(),
        }
    });
    let id = createId();
    console.log(`Downloading file from URL: ${url} to ${workDir}/${id} w/t ${`curl -O --output-dir ${workDir}/${id}/ "${url}"`}`);
    fs.mkdirSync(`${workDir}/${id}`, { recursive: true });
    let t = await $`curl -O --output-dir ${workDir}/${id}/ "${url}"`;
    if (t.exitCode !== 0) {
        console.error(`Failed to download file from ${url}. Exit code: ${t.exitCode}`);
        return {
            size: 0, success: false
        }
    }
    await prisma.insuranceScanJob.update({
        where: {
            id: jobId
        },
        data: {
            status: 'DECOMPRESSING',
            statusTime: new Date(),
        }
    });
    // find all files and decompress bassed on extension
    let files = fs.readdirSync(`${workDir}/${id}`);
    for (let file of files) {
        if (file.endsWith(".gz")) {
            console.log(`Decompressing gzip file: ${file}`);
            let decompress = await $`gunzip -c ${workDir}/${id}/${file} > ${workDir}/${id}/${file.replace(/\.gz$/, '')}`;
            if (decompress.exitCode !== 0) {
                console.error(`Failed to decompress file: ${file}. Exit code: ${decompress.exitCode}`);
                return {
                    size: 0, success: false, message: `Failed to decompress file: ${file}`
                }
            }
        } else if (file.endsWith(".zip")) {
            console.log(`Decompressing zip file: ${file}`);
            try {
                let decompress = await $`unzip ${workDir}/${id}/${file} -d ${workDir}/${id}/`;
                if (decompress.exitCode !== 0) {
                    console.error(`Failed to decompress file: ${file}. Exit code: ${decompress.exitCode}`);
                    return {
                        size: 0, success: false, message: `Failed to decompress file: ${file}`
                    }
                }
                // remove the zip file after extraction
                fs.unlinkSync(`${workDir}/${id}/${file}`);
            } catch (error) {
                console.error(`Error decompressing zip file: ${file}. Error: ${error}`);
            }
            await sleep(5000); // wait for a second to ensure files are written to disk
        }
    }
    await prisma.insuranceScanJob.update({
        where: {
            id: jobId
        },
        data: {
            status: 'PARSING',
            statusTime: new Date(),
        }
    });
    // calculate total size of all files in the directory
    let totalSize = 0;
    let finalFiles = fs.readdirSync(`${workDir}/${id}`);
    for (let file of finalFiles) {
        let stats = fs.statSync(`${workDir}/${id}/${file}`);
        totalSize += stats.size;
        let fileHash = await $`sha256sum ${workDir}/${id}/${file}`.text();
        console.log(`File: ${file}, Size: ${stats.size} bytes, Hash: ${fileHash.split(' ')[0]}`);
        await prisma.insuranceScanDecompressedFile.create({
            data: {
                id: generateId(IDTYPE.INSURANCE_JOB_FILE),
                insuranceScanJobId: jobId,
                fileName: file,
                fileSize: BigInt(stats.size),
                fileType: getFileTypeFromName(file),
                fileExtension: getFileExtensionFromUrlWithQuery(getFileExtensionFromName(file)),
                fileHash: fileHash.split(' ')[0] ?? '',
                createdAt: new Date(),
            }
        });
    }
    let errors: string[] = []
    // parse 
    for (let file of finalFiles) {
        console.log(`Parsing file run main ${workDir}/${id}/${file} in_network_rates`);
        // add parsing logic here as needed
        let t = await $`RABBITMQ_USER=${process.env.RABBITMQ_USER} RABBITMQ_PASSWORD=${process.env.RABBITMQ_PASSWORD} RABBITMQ_HOST=${process.env.RABBITMQ_HOST} SHARD_ID=${shardId} ../../parser-tools/parser-rs/target/release/main ${workDir}/${id}/${file} in_network_rates ${jobId}`.catch(async (error) => {
            return error.message;
        })
        if (!t) {
            errors.push(t);
            console.error(`Failed to parse file: ${file}. Error: ${t}`);
        }
    }

    await $`rm -rf ${workDir}/${id}`;
    if (errors.length > 0) {
        return {
            size: 0, success: false, message: `Failed to parse ${errors} files.`
        }
    }
    console.log(`Total size of downloaded files: ${totalSize} bytes`);
    return {
        size: totalSize, success: true
    }
}

function getFileExtensionFromUrlWithQuery(extension: string): FileExtension {
    switch (extension.toLowerCase()) {
        case 'json':
            return FileExtension.JSON;
    }
    return FileExtension.UNKNOWN;
}

function getFileExtensionFromName(fileName: string): string {
    // handle multiple extensions like .tar.gz
    let parts = fileName.split('.');
    if (parts.length > 2) {
        return parts.slice(1).join('.').toLowerCase();
    } else if (parts.length === 2) {
        return parts[1]?.toLowerCase() ?? ''
    } else {
        return '';
    }
}

function getFileTypeFromName(fileName: string): FileType {
    if (fileName.toLowerCase().includes('in-network')) {
        return FileType.IN_NETWORK;
    } else if (fileName.toLowerCase().includes('allowed-amount')) {
        return FileType.ALLOWED_AMOUNT;
    } else {
        console.warn(`Unknown file type for file name: ${fileName}`);
        return FileType.UNKNOWN;
    }
}