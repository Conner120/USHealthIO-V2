"use server"
import {getProviderLicenses} from "@/app/providers/[providerId]/_lib/getProvider";
import {Card, CardContent} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export default async function Page({params}: { params: Promise<{ providerId: string }> }) {
    const {providerId} = await params;
    const licenses = await getProviderLicenses(providerId);

    return (
        <main className="flex-1">
            <div className="space-y-6 px-4 py-6">
                <div>
                    <h2 className="text-2xl font-bold">Licenses</h2>
                    <p className="text-muted-foreground">State licenses for this provider</p>
                </div>

                {licenses.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            No licenses on file.
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>License Number</TableHead>
                                        <TableHead>State</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {licenses.map((lic) => (
                                        <TableRow key={lic.id}>
                                            <TableCell className="font-medium">{lic.licenseNumber}</TableCell>
                                            <TableCell>{lic.state}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>
        </main>
    );
}
