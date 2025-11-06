"use client"

import {useForm} from "react-hook-form"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {saveToDatabase} from "@/app/insurance/companies/new/_lib/save";

interface NameFormData {
    displayName: string
    legalName: string
}


export default function Page() {
    const {
        register,
        handleSubmit,
        formState: {errors},
        reset,
    } = useForm<NameFormData>({
        defaultValues: {
            displayName: "",
            legalName: "",
        },
    })


    const onSubmit = (data: NameFormData) => {
        console.log(data)
        saveToDatabase(data).then(() => {
            reset()
            alert("Insurance Company saved successfully!")
        }).catch((error) => {
            console.error("Error saving Insurance Company:", error)
            alert(`Failed to save Insurance Company. ${error.message}`)
        })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Name Information</CardTitle>
                <CardDescription>Enter your display name and legal name</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="display-name">Display Name</Label>
                        <Input
                            id="display-name"
                            placeholder="Enter your display name"
                            {...register("displayName", {
                                required: "Display name is required",
                            })}
                        />
                        {errors.displayName && <p className="text-sm text-destructive">{errors.displayName.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="legal-name">Legal Name</Label>
                        <Input
                            id="legal-name"
                            placeholder="Enter your legal name"
                            {...register("legalName", {
                                required: "Legal name is required",
                            })}
                        />
                        {errors.legalName && <p className="text-sm text-destructive">{errors.legalName.message}</p>}
                    </div>

                    <Button type="submit" className="w-full">
                        Submit
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
