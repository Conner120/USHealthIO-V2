import {Field, FieldGroup, FieldLabel, FieldLegend} from "@/components/ui/field";
import {Input} from "@/components/ui/input";

export function CignaIndexForm(props: {
    onChangeJson: (key: string, value: string | number | boolean | number) => void
}) {
    return (
        <>
            <FieldLegend>Cigna Source Settings</FieldLegend>
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor="source-cigna-page-url">
                        Page URL
                    </FieldLabel>
                    <Input
                        id="source-cigna-page-url"
                        placeholder="Enter your display name"
                        required
                        onChange={(any) => {
                            props.onChangeJson("cigna_page_url", any.target.value)
                        }}
                    />
                </Field>
            </FieldGroup>
        </>
    )
}