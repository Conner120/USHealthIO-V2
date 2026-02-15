import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function UnitedBlobForm(props: {
  onChangeJson: (
    key: string,
    value: string | number | boolean | number,
  ) => void;
}) {
  return (
    <>
      <FieldLegend>United Blob Source Settings</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="source-united-blob-page-url">
            Page URL
          </FieldLabel>
          <Input
            id="source-united-blob-page-url"
            placeholder="Enter your display name"
            required
            onChange={(any) => {
              props.onChangeJson("united_blob_page_url", any.target.value);
            }}
          />
        </Field>
      </FieldGroup>
    </>
  );
}
