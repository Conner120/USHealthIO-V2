"use server"
import {getProviderAddresses} from "@/app/providers/[providerId]/_lib/getProvider";
import {Card, CardContent} from "@/components/ui/card";

export default async function Page({params}: { params: Promise<{ providerId: string }> }) {
    const {providerId} = await params;
    const addresses = await getProviderAddresses(providerId);

    return (
        <main className="flex-1">
            <div className="space-y-6 px-4 py-6">
                <div>
                    <h2 className="text-2xl font-bold">Addresses</h2>
                    <p className="text-muted-foreground">Registered addresses for this provider</p>
                </div>

                {addresses.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            No addresses on file.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {addresses.map((addr) => (
                            <Card key={addr.id}>
                                <CardContent className="pt-6 text-sm space-y-1">
                                    <p className="font-medium">{addr.address1}</p>
                                    {addr.address2 && <p>{addr.address2}</p>}
                                    <p>{addr.city}, {addr.state} {addr.zipCode}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
