"use server"
import {getProviderTaxonomies} from "@/app/providers/[providerId]/_lib/getProvider";
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
    const taxonomies = await getProviderTaxonomies(providerId);

    return (
        <main className="flex-1">
            <div className="space-y-6 px-4 py-6">
                <div>
                    <h2 className="text-2xl font-bold">Taxonomies</h2>
                    <p className="text-muted-foreground">Healthcare taxonomy classifications</p>
                </div>

                {taxonomies.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            No taxonomies on file.
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Taxonomy Code</TableHead>
                                        <TableHead>Primary</TableHead>
                                        <TableHead>License Number</TableHead>
                                        <TableHead>License State</TableHead>
                                        <TableHead>Group Code</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {taxonomies.map((tax) => (
                                        <TableRow key={tax.id}>
                                            <TableCell className="font-medium font-mono">{tax.taxonomyCode}</TableCell>
                                            <TableCell>
                                                {tax.isPrimary === "Y" ? "Yes" : tax.isPrimary === "N" ? "No" : "—"}
                                            </TableCell>
                                            <TableCell>{tax.licenseNumber ?? "—"}</TableCell>
                                            <TableCell>{tax.licenseState ?? "—"}</TableCell>
                                            <TableCell>{tax.groupCode ?? "—"}</TableCell>
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
