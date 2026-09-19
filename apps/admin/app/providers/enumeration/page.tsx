"use client"
import {useEffect, useState} from "react";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from "@/components/ui/card";
import {Checkbox} from "@/components/ui/checkbox";
import {Spinner} from "@/components/ui/spinner";
import {CheckCircle, AlertCircle} from "lucide-react";
import {fetchNpiFiles, triggerNpiImport, type NpiFileInfo} from "@/lib/kafka";

export default function ProviderEnumerationPage() {
    const [files, setFiles] = useState<NpiFileInfo[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
    const [triggerState, setTriggerState] = useState<null | "PENDING" | "SUCCESS" | "ERROR">(null);
    const [results, setResults] = useState<{ jobId: string; fileUrl: string }[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchNpiFiles()
            .then((f) => {
                setFiles(f);
                setLoadState("loaded");
            })
            .catch((e) => {
                setError(e instanceof Error ? e.message : "Failed to fetch NPI files");
                setLoadState("error");
            });
    }, []);

    const fullFiles = files.filter(f => f.type === "full");
    const weeklyFiles = files.filter(f => f.type === "weekly");

    const toggleFile = (url: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(url)) next.delete(url);
            else next.add(url);
            return next;
        });
    };

    const selectAll = () => setSelected(new Set(files.map(f => f.url)));
    const selectFull = () => setSelected(new Set(fullFiles.map(f => f.url)));
    const selectWeekly = () => setSelected(new Set(weeklyFiles.map(f => f.url)));
    const selectNone = () => setSelected(new Set());

    const handleTrigger = async () => {
        if (selected.size === 0) return;
        setTriggerState("PENDING");
        setError(null);
        try {
            const res = await triggerNpiImport(Array.from(selected));
            setResults(res.jobs);
            setTriggerState("SUCCESS");
            setTimeout(() => setTriggerState(null), 5000);
        } catch (e) {
            setTriggerState("ERROR");
            setError(e instanceof Error ? e.message : "Unknown error");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold">Provider Enumeration</h2>
                <p className="text-muted-foreground">
                    Import NPI provider data from the CMS NPPES registry
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>NPI Data Import</CardTitle>
                    <CardDescription>
                        Select which NPI files to import from the CMS NPPES download page.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Source: https://download.cms.gov/nppes/NPI_Files.html
                    </p>

                    {loadState === "loading" && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Spinner/> Fetching available files...
                        </div>
                    )}

                    {loadState === "error" && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}

                    {loadState === "loaded" && (
                        <>
                            <div className="flex gap-2 flex-wrap">
                                <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
                                <Button variant="outline" size="sm" onClick={selectFull}>Select Full</Button>
                                <Button variant="outline" size="sm" onClick={selectWeekly}>Select Weekly</Button>
                                <Button variant="outline" size="sm" onClick={selectNone}>Clear</Button>
                            </div>

                            {fullFiles.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium">Full Monthly</h4>
                                    {fullFiles.map(f => (
                                        <label key={f.url}
                                               className="flex items-center gap-2 text-sm cursor-pointer">
                                            <Checkbox
                                                checked={selected.has(f.url)}
                                                onCheckedChange={() => toggleFile(f.url)}
                                            />
                                            <span className="break-all">{f.filename}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {weeklyFiles.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium">Weekly Incremental</h4>
                                    {weeklyFiles.map(f => (
                                        <label key={f.url}
                                               className="flex items-center gap-2 text-sm cursor-pointer">
                                            <Checkbox
                                                checked={selected.has(f.url)}
                                                onCheckedChange={() => toggleFile(f.url)}
                                            />
                                            <span className="break-all">{f.filename}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {triggerState === "SUCCESS" && results.length > 0 && (
                        <div className="mt-4 text-sm space-y-2 border-t pt-4">
                            <p className="font-medium">Jobs created:</p>
                            {results.map(r => (
                                <div key={r.jobId} className="space-y-0.5">
                                    <p><span className="font-medium">Job:</span> {r.jobId}</p>
                                    <p className="break-all text-muted-foreground">{r.fileUrl}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {error && triggerState === "ERROR" && (
                        <p className="mt-4 text-sm text-destructive">{error}</p>
                    )}
                </CardContent>
                <CardFooter>
                    <Button disabled={triggerState === "PENDING" || selected.size === 0} onClick={handleTrigger}>
                        Import {selected.size} {selected.size === 1 ? "File" : "Files"}
                        {triggerState === "PENDING" && <Spinner/>}
                        {triggerState === "SUCCESS" && <CheckCircle/>}
                        {triggerState === "ERROR" && <AlertCircle/>}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
