"use client"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Label} from "@/components/ui/label";
import {ProviderDetail} from "@/app/providers/[providerId]/_lib/getProvider";

function Field({label, value}: { label: string; value: string | null | undefined }) {
    return (
        <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">{label}</Label>
            <p className="text-sm font-medium">{value || "—"}</p>
        </div>
    );
}

function formatDate(date: Date | null | undefined) {
    if (!date) return null;
    return new Date(date).toLocaleDateString();
}

export default function ProviderGeneralDetails({provider}: { provider: ProviderDetail }) {
    const isOrg = provider.entityTypeCode === "ORGANIZATION";

    return (
        <main className="flex-1">
            <div className="space-y-6 px-4 py-6">
                <div>
                    <h2 className="text-2xl font-bold">
                        {isOrg
                            ? provider.businessName
                            : [provider.namePrefix, provider.firstName, provider.middleName, provider.lastName, provider.nameSuffix]
                                .filter(Boolean)
                                .join(" ")}
                    </h2>
                    <p className="text-muted-foreground">
                        NPI: {provider.providerNPI} &middot;{" "}
                        {isOrg ? "Organization" : "Individual"}
                        {provider.credential && ` · ${provider.credential}`}
                    </p>
                </div>

                {/* Identity */}
                <Card>
                    <CardHeader>
                        <CardTitle>Identity</CardTitle>
                        <CardDescription>Core provider identification</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <Field label="NPI" value={provider.providerNPI}/>
                            <Field label="Entity Type" value={isOrg ? "Organization" : "Individual"}/>
                            <Field label="Replacement NPI" value={provider.replacementNPI}/>
                            <Field label="EIN" value={provider.ein}/>
                            <Field label="Gender" value={
                                provider.genderCode === "M" ? "Male" :
                                    provider.genderCode === "F" ? "Female" : null
                            }/>
                            <Field label="Sole Proprietor" value={
                                provider.isSoleProprietor === "Y" ? "Yes" :
                                    provider.isSoleProprietor === "N" ? "No" : null
                            }/>
                        </div>
                    </CardContent>
                </Card>

                {/* Name Details */}
                <Card>
                    <CardHeader>
                        <CardTitle>{isOrg ? "Organization Name" : "Provider Name"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {isOrg ? (
                                <>
                                    <Field label="Business Name" value={provider.businessName}/>
                                    <Field label="Other Organization Name" value={provider.otherOrganizationName}/>
                                    <Field label="Organization Subpart" value={
                                        provider.isOrganizationSubpart === "Y" ? "Yes" :
                                            provider.isOrganizationSubpart === "N" ? "No" : null
                                    }/>
                                    <Field label="Parent Organization" value={provider.parentOrganizationName}/>
                                    <Field label="Parent Organization TIN" value={provider.parentOrganizationTIN}/>
                                </>
                            ) : (
                                <>
                                    <Field label="Prefix" value={provider.namePrefix}/>
                                    <Field label="First Name" value={provider.firstName}/>
                                    <Field label="Middle Name" value={provider.middleName}/>
                                    <Field label="Last Name" value={provider.lastName}/>
                                    <Field label="Suffix" value={provider.nameSuffix}/>
                                    <Field label="Credential" value={provider.credential}/>
                                    <Field label="Other First Name" value={provider.otherFirstName}/>
                                    <Field label="Other Last Name" value={provider.otherLastName}/>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Authorized Official (orgs only) */}
                {isOrg && (provider.authorizedOfficialFirstName || provider.authorizedOfficialLastName) && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Authorized Official</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <Field label="First Name" value={provider.authorizedOfficialFirstName}/>
                                <Field label="Middle Name" value={provider.authorizedOfficialMiddleName}/>
                                <Field label="Last Name" value={provider.authorizedOfficialLastName}/>
                                <Field label="Title" value={provider.authorizedOfficialTitle}/>
                                <Field label="Phone" value={provider.authorizedOfficialPhone}/>
                                <Field label="Credential" value={provider.authorizedOfficialCredential}/>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Dates & Status */}
                <Card>
                    <CardHeader>
                        <CardTitle>Status & Dates</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <Field label="Enumeration Date" value={formatDate(provider.enumerationDate)}/>
                            <Field label="Last NPI Update" value={formatDate(provider.lastUpdateDate)}/>
                            <Field label="Certification Date" value={formatDate(provider.certificationDate)}/>
                            <Field label="Deactivation Date" value={formatDate(provider.deactivationDate)}/>
                            <Field label="Deactivation Reason" value={
                                provider.deactivationReasonCode === "DT" ? "Death" :
                                    provider.deactivationReasonCode === "DB" ? "Disbandment" :
                                        provider.deactivationReasonCode === "FR" ? "Fraud" :
                                            provider.deactivationReasonCode === "OT" ? "Other" : null
                            }/>
                            <Field label="Reactivation Date" value={formatDate(provider.reactivationDate)}/>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
