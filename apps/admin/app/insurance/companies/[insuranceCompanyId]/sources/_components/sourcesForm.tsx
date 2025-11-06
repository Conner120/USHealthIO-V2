"use client"
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from "@/components/ui/card";
import {useForm} from "react-hook-form";
import {Button} from "@/components/ui/button";
import {$Enums, InsuranceScanSource} from "@repo/database";
import {SendTICJobTrigger} from "@/lib/kafka";
import {useState} from "react";
import {Spinner} from "@/components/ui/spinner";
import {CheckCircle} from "lucide-react";
import {createId} from "@paralleldrive/cuid2";

type InsuranceScanSourceForm = {
    sourceType: $Enums.InsuranceScanSourceType
}

export default function SourcesForm(props: { currentValue: InsuranceScanSource }) {
    const {
        handleSubmit,
        formState: {isDirty}

    } = useForm<InsuranceScanSourceForm>({
        values: props.currentValue
    })

    const onSubmit = (data: InsuranceScanSourceForm) => {
    }
    const [manualTriggerState, setManualTriggerState] = useState<null | 'PENDING' | 'SUCCESS'>(null)
    const jobTriggerIdempotenceId = createId()
    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{props.currentValue.name}</CardTitle>
                    <CardDescription>{props.currentValue.notes}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">

                </CardContent>
                {isDirty && (
                    <CardFooter>
                        <Button type={'submit'}>Save</Button>
                        <div className="mr-auto"/>
                        <Button type={'reset'}>Cancel</Button>
                    </CardFooter>
                )}
                <CardFooter>
                    <Button disabled={manualTriggerState === "PENDING"} onClick={() => {
                        setManualTriggerState('PENDING')
                        SendTICJobTrigger(props.currentValue.id, jobTriggerIdempotenceId).then(() => {
                            setManualTriggerState('SUCCESS')
                            setTimeout(() => {
                                setManualTriggerState(null)
                            }, 3000)
                        })
                    }}>
                        Trigger Import
                        {manualTriggerState === "PENDING" && (
                            <Spinner/>
                        )}
                        {manualTriggerState === "SUCCESS" && (
                            <CheckCircle/>
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </form>
    )
}