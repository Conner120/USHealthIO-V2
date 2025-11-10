import { createId } from "@paralleldrive/cuid2";
import fs from "fs";
import { $, spawn, spawnSync } from "bun";
import { FileExtension, FileType, prisma } from "@repo/database";
import { generateId, IDTYPE } from "@repo/id-gen";
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
    console.log(`Downloading file from URL: ${url} to /tmp/${id} w/t ${`curl -O --output-dir /tmp/${id}/ "${url}"`}`);
    fs.mkdirSync(`/tmp/${id}`, { recursive: true });
    let t = await $`curl -O --output-dir /tmp/${id}/ "${url}"`;
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
    let files = fs.readdirSync(`/tmp/${id}`);
    for (let file of files) {
        if (file.endsWith(".gz")) {
            console.log(`Decompressing gzip file: ${file}`);
            let decompress = await $`gunzip /tmp/${id}/${file}`;
            if (decompress.exitCode !== 0) {
                console.error(`Failed to decompress file: ${file}. Exit code: ${decompress.exitCode}`);
                return {
                    size: 0, success: false, message: `Failed to decompress file: ${file}`
                }
            }
        } else if (file.endsWith(".zip")) {
            console.log(`Decompressing zip file: ${file}`);
            try {
                let decompress = await $`unzip /tmp/${id}/${file} -d /tmp/${id}/`;
                if (decompress.exitCode !== 0) {
                    console.error(`Failed to decompress file: ${file}. Exit code: ${decompress.exitCode}`);
                    return {
                        size: 0, success: false, message: `Failed to decompress file: ${file}`
                    }
                }
                // remove the zip file after extraction
                fs.unlinkSync(`/tmp/${id}/${file}`);
            } catch (error) {
                console.error(`Error decompressing zip file: ${file}. Error: ${error}`);
            }
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
    let finalFiles = fs.readdirSync(`/tmp/${id}`);
    for (let file of finalFiles) {
        let stats = fs.statSync(`/tmp/${id}/${file}`);
        totalSize += stats.size;
        let fileHash = await $`sha256sum /tmp/${id}/${file}`.text();
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
    // parse 
    for (let file of finalFiles) {
        console.log(`Parsing file: ${file}`);
        // add parsing logic here as needed
        await $`../../parser-tools/parser-rs/target/release/main /tmp/${id}/${file}`;
    }

    await $`rm -rf /tmp/${id}`;
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