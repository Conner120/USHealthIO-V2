import { createId } from "@paralleldrive/cuid2";
import fs from "fs";
import { $, spawn, spawnSync } from "bun";
export async function getFile(url: string): Promise<{
    size: number;
    success: boolean;
    message?: string;
}> {
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
            let decompress = await $`unzip /tmp/${id}/${file} -d /tmp/${id}/`;
            if (decompress.exitCode !== 0) {
                console.error(`Failed to decompress file: ${file}. Exit code: ${decompress.exitCode}`);
                return {
                    size: 0, success: false, message: `Failed to decompress file: ${file}`
                }
            }
            // remove the zip file after extraction
            fs.unlinkSync(`/tmp/${id}/${file}`);
        }
    }
    // calculate total size of all files in the directory
    let totalSize = 0;
    let finalFiles = fs.readdirSync(`/tmp/${id}`);
    for (let file of finalFiles) {
        let stats = fs.statSync(`/tmp/${id}/${file}`);
        totalSize += stats.size;
    }
    await $`rm -rf /tmp/${id}`;
    console.log(`Total size of downloaded files: ${totalSize} bytes`);
    return {
        size: totalSize, success: true
    }
}