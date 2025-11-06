"use client"
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from "@/components/ui/card";
import {useForm} from "react-hook-form";
import {Button} from "@/components/ui/button";
import {InsuranceCompany} from "@repo/database";
import {saveGeneral} from "@/app/insurance/companies/[insuranceCompanyId]/_lib/saveGeneral";
import {Label} from "@/components/ui/label";
import {Input} from "@/components/ui/input";

export default function GeneralForm(props: { currentValue: InsuranceCompany }) {
    const {
        register,
        handleSubmit,
        formState: {isDirty, isSubmitting, isLoading, errors}

    } = useForm<InsuranceCompany>({
        values: props.currentValue
    })

    const onSubmit = (data: { displayName: string, legalName: string }) => {
        saveGeneral(props.currentValue.id, data).then(() => {
            window.location.reload()
        })
    }

    return (
        <main className="flex-1">
            <div className="space-y-6 px-4 py-6">
                <div>
                    <h2 className="text-2xl font-bold">General</h2>
                    <p className="text-muted-foreground">Manage setting and information about this health insurance
                        company</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Company Info</CardTitle>
                            <CardDescription>General Info About Insurance Company</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">

                            {/*    edit display name and legal name*/}
                            <div className="space-y-2">
                                <Label htmlFor="display-name">Display Name</Label>
                                <Input
                                    disabled={isSubmitting || isLoading}
                                    id="display-name"
                                    placeholder="Enter your display name"
                                    {...register("displayName", {
                                        required: "Display name is required",
                                    })}
                                />
                                {errors.displayName &&
                                    <p className="text-sm text-destructive">{errors.displayName.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="legal-name">Legal Name</Label>
                                <Input
                                    disabled={isSubmitting || isLoading}
                                    id="legal-name"
                                    placeholder="Enter your legal name"
                                    {...register("legalName", {
                                        required: "Legal name is required",
                                    })}
                                />
                                {errors.legalName &&
                                    <p className="text-sm text-destructive">{errors.legalName.message}</p>}
                            </div>
                        </CardContent>
                        {isDirty && (
                            <CardFooter>
                                <Button type={'submit'}>Save</Button>
                                <div className="mr-auto"/>
                                <Button type={'reset'}>Cancel</Button>
                            </CardFooter>
                        )}
                    </Card>
                </form>
            </div>
        </main>
    )
}