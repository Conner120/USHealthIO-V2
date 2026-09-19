"use server"
import {getProvider} from "@/app/providers/[providerId]/_lib/getProvider";
import ProviderGeneralDetails from "@/app/providers/[providerId]/_components/providerGeneralDetails";

export default async function Page({params}: { params: Promise<{ providerId: string }> }) {
    const {providerId} = await params;
    const provider = await getProvider(providerId);
    if (!provider) {
        return <div>Provider not found</div>
    }
    return (
        <ProviderGeneralDetails provider={provider}/>
    )
}
