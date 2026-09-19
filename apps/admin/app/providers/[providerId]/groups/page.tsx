"use server"
import {getProviderGroups} from "@/app/providers/[providerId]/_lib/getProvider";
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
    const groups = await getProviderGroups(providerId);

    return (
        <main className="flex-1">
            <div className="space-y-6 px-4 py-6">
                <div>
                    <h2 className="text-2xl font-bold">Provider Groups</h2>
                    <p className="text-muted-foreground">Groups this provider belongs to</p>
                </div>

                {groups.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            Not a member of any provider groups.
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Group Name</TableHead>
                                        <TableHead>TIN</TableHead>
                                        <TableHead>Active</TableHead>
                                        <TableHead>First Seen</TableHead>
                                        <TableHead>Last Seen</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groups.map((gp) => (
                                        <TableRow key={gp.id}>
                                            <TableCell className="font-medium">{gp.groupName}</TableCell>
                                            <TableCell className="font-mono">{gp.tinValue}</TableCell>
                                            <TableCell>
                                                {gp.isActive ? (
                                                    <span className="text-green-600 font-medium">Active</span>
                                                ) : (
                                                    <span className="text-muted-foreground">Inactive</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{new Date(gp.firstSeen).toLocaleDateString()}</TableCell>
                                            <TableCell>{new Date(gp.lastSeen).toLocaleDateString()}</TableCell>
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
