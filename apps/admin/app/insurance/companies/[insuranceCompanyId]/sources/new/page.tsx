"use client"

import {Controller, useForm, useWatch} from "react-hook-form"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Card, CardContent} from "@/components/ui/card"
import {$Enums} from "@repo/database"
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet
} from "@/components/ui/field";
import {Textarea} from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {CignaIndexForm} from "@/app/insurance/companies/[insuranceCompanyId]/sources/new/_components/cigna_index_form";
import {saveToDatabase} from "@/app/insurance/companies/[insuranceCompanyId]/sources/new/_lib/save";
import {useParams, useRouter} from "next/navigation";

interface SourceFormData {
    name: string;
    notes: string;
    sourceType: $Enums.InsuranceScanSourceType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: any;
}


export default function Page() {
    const {
        register,
        setValue,
        handleSubmit,
        control,
        formState: {errors},
    } = useForm<SourceFormData>({})
    const {insuranceCompanyId} = useParams<{ insuranceCompanyId: string }>();
    const router = useRouter()
    const onSubmit = (data: SourceFormData) => {
        saveToDatabase(insuranceCompanyId, data).then(() => {
            router.back();
        })
    }

    const sourceType = useWatch({
        name: 'sourceType',
        compute: (data) => {
            console.log(data)
            return data?.length ? data : ''
        },
        control
    });
    const getRouter = () => {

        if (sourceType === $Enums.InsuranceScanSourceType.CIGNA_INDEX_API.toString()) {
            return <CignaIndexForm onChangeJson={(key, value) => {
                setValue(`options.${key}`, value)
            }}/>
        }
        return <></>
    }

    return (
        <Card className="w-full">
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <FieldGroup>
                        <FieldSet>
                            <FieldLegend>General</FieldLegend>
                            <FieldDescription>
                                Basic information about the import source
                            </FieldDescription>
                            <FieldGroup>
                                <Field>
                                    <FieldLabel htmlFor="source-name">
                                        Name
                                    </FieldLabel>
                                    <Input
                                        id="source-name"
                                        placeholder="Enter your display name"
                                        required
                                        {...register("name", {
                                            required: "Name is required",
                                        })}
                                    />
                                    {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                                </Field>
                                <Controller
                                    name="sourceType"
                                    control={control}
                                    render={({field, fieldState}) => (
                                        <Field>
                                            <FieldLabel htmlFor="source-source-type">
                                                Source Type
                                            </FieldLabel>
                                            <Select
                                                name={field.name}
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger className="w-[180px]" aria-invalid={fieldState.invalid}>
                                                    <SelectValue placeholder="Select a source type"/>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectLabel>Generic</SelectLabel>
                                                        <SelectItem value="INDEX_URL">Index URL</SelectItem>
                                                        <SelectItem value="MANUAL">Manual</SelectItem>
                                                        <SelectLabel>Api</SelectLabel>
                                                        <SelectItem value="CIGNA_INDEX_API">CIGNA_INDEX_API</SelectItem>
                                                        <SelectItem
                                                            value="UNITED_HEATHCARE_BLOB_API">UNITED_HEATHCARE_BLOB_API</SelectItem>
                                                        <SelectItem value="AETNA_BLOB_API">AETNA_BLOB_API</SelectItem>
                                                        <SelectItem
                                                            value="KAISER_PERMANENTE_TXT_IN_NETWORK">KAISER_PERMANENTE_TXT_IN_NETWORK</SelectItem>
                                                        <SelectItem
                                                            value="KAISER_PERMANENTE_TXT_OUT_OF_NETWORK">KAISER_PERMANENTE_TXT_OUT_OF_NETWORK</SelectItem>
                                                        <SelectLabel>Scrape</SelectLabel>
                                                        <SelectItem value="HCSC_SCRAPER">HCSC_SCRAPER</SelectItem>
                                                        <SelectItem value="CIGNA_SCRAPER">CIGNA_SCRAPER</SelectItem>
                                                        <SelectItem
                                                            value="MOLINA_HEALTHCARE_SCRAPER">MOLINA_HEALTHCARE_SCRAPER</SelectItem>

                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                            <FieldDescription>
                                                Type of source to import data from see docs: TODO: Make docs
                                            </FieldDescription>
                                            {fieldState.invalid && (
                                                <FieldError errors={[fieldState.error]}/>
                                            )}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>
                            {getRouter()}
                            <FieldSet>
                                <FieldLegend>Metadata</FieldLegend>
                                <FieldDescription>
                                    Additional information about the source
                                </FieldDescription>
                                <FieldGroup>
                                    <Field>
                                        <FieldLabel htmlFor="source-notes">
                                            Notes
                                        </FieldLabel>
                                        <Textarea
                                            id="source-notes"
                                            placeholder="Enter notes on the source"
                                            required
                                            className="h-50"
                                            {...register("notes", {
                                                required: "Notes are required",
                                            })}
                                        />
                                        {errors.notes &&
                                            <p className="text-sm text-destructive">{errors.notes.message}</p>}
                                    </Field>
                                </FieldGroup>
                            </FieldSet>
                        </FieldSet>
                    </FieldGroup>

                    <Button type="submit" className="w-full">
                        Submit
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
