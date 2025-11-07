import axios from "axios";
import fs from "fs";
import { producer } from "..";
export async function importCignaData(data: any, heartbeat?: () => Promise<void>) {
    console.log("Importing Cigna data with payload:", data);
    if (!data.options || !data.options['cigna_page_url']) {
        throw new Error("Cigna page URL is missing in options");
    }
    const blobs = await axios.get(data.options['cigna_page_url']);
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
    // Process the first MRF (Medical Record File)
    const mrf = blobs.data.mrfs[0];
    // Here you would add logic to store the MRF in your database or further process it
    console.log("Fetched Cigna data:", mrf);
    console.log("Cigna data import completed.");
    if (mrf.files.length !== 1) {
        console.warn(`Expected 1 file in MRF, but found ${mrf.files.length}.`);
        return;
    }
    const file = mrf.files[0].url;
    console.log("Cigna MRF file URL:", file);
    const indexFile = await axios.get(file);
    if (indexFile.status !== 200) {
        throw new Error(`Failed to fetch Cigna MRF file, status code: ${indexFile.status}`);
    }
    fs.writeFileSync('./cigna_index_file.json', JSON.stringify(indexFile.data, null, 2));
    const filesToImport: {
        reportingPlans: string[],
        file: {
            url: string
            type: "in_network" | "allowed_amount"
        }
    }[] = [];
    let filesToImportIndex: { [key: string]: number } = {};
    for (const fileReport of indexFile.data.reporting_structure) {
        // lookup plans / upsert or create as needed
        //TODO: implement plan lookup / upsert
        let plans: string[] = [];
        //parse allowed amount files
        if (fileReport.allowed_amount_file) {
            if (fileReport.allowed_amount_file.location.includes('cigna-health-life-insurance-company_empty_allowed-amounts.json')) {
                console.log("Skipping empty allowed amount file:", fileReport.allowed_amount_file.location);
                continue;
            }
            let index = filesToImportIndex[fileReport.allowed_amount_file.location] = filesToImport.length;
            if (filesToImport[index]) {
                filesToImport[index].reportingPlans.push(...plans);
            } else {
                console.log("Pushing new allowed amount file:", fileReport.allowed_amount_file);
                filesToImport.push({
                    reportingPlans: plans,
                    file: {
                        url: fileReport.allowed_amount_file.location,
                        type: "allowed_amount"
                    }
                });
                filesToImportIndex[fileReport.allowed_amount_file.location] = filesToImport.length - 1;
            }
        }
        if (fileReport.in_network_files) {
            for (const inNetworkFile of fileReport.in_network_files) {
                let index = filesToImportIndex[inNetworkFile.location] = filesToImport.length;
                if (filesToImport[index]) {
                    filesToImport[index].reportingPlans.push(...plans);
                } else {
                    console.log("Pushing new in-network file:", inNetworkFile);
                    filesToImport.push({
                        reportingPlans: plans,
                        file: {
                            url: inNetworkFile.location,
                            type: "in_network"
                        }
                    });
                    filesToImportIndex[inNetworkFile.location] = filesToImport.length - 1;
                }
            }
        }
    }
    // split into chunks of 100
    const chunkSize = 100;
    for (let i = 0; i < filesToImport.filter(f => f.file.type === "in_network").length; i += chunkSize) {
        const chunk = filesToImport.filter(f => f.file.type === "in_network").slice(i, i + chunkSize);
        await producer.send({
            topic: 'in-network-file',
            messages: chunk.map(fileToImport => ({
                value: JSON.stringify({
                    topic: 'in-network-file',
                    payload: {
                        sourceType: 'CIGNA_INDEX_API',
                        url: fileToImport.file.url,
                        reportingPlans: fileToImport.reportingPlans,
                    }
                }),
            })),
        });
        console.log(`Dispatched in-network-file chunk with ${chunk.length} files.`);
    }
    for (let i = 0; i < filesToImport.filter(f => f.file.type === "allowed_amount").length; i += chunkSize) {
        const chunk = filesToImport.filter(f => f.file.type === "allowed_amount").slice(i, i + chunkSize);
        await producer.send({
            topic: 'allowed-amount',
            messages: chunk.map(fileToImport => ({
                value: JSON.stringify({
                    topic: 'allowed-amount',
                    payload: {
                        sourceType: 'CIGNA_INDEX_API',
                        url: fileToImport.file.url,
                        reportingPlans: fileToImport.reportingPlans,
                    }
                }),
            })),
        });
        console.log(`Dispatched allowed-amount chunk with ${chunk.length} files.`);
    }
    console.log("All files dispatched for import.");
}