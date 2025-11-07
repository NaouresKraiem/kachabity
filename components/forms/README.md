# Form Components

Reusable form components with built-in validation support for React Hook Form + Zod.

## Components

### FormInput
Text input component with validation error display.

**Usage:**
```tsx
import { FormInput } from "@/components/forms";

<FormInput
  label="Email Address"
  name="email"
  type="email"
  placeholder="Enter your email"
  register={register}
  error={errors.email}
  required
/>
```

**Props:**
- `label` - Label text
- `name` - Field name (must match schema)
- `type` - Input type (text, email, tel, number)
- `placeholder` - Placeholder text
- `register` - React Hook Form register function
- `error` - Field error object from formState
- `required` - Shows red asterisk if true
- `className` - Optional additional classes

---

### FormSelect
Dropdown select component with validation.

**Usage:**
```tsx
import { FormSelect } from "@/components/forms";

<FormSelect
  label="Country"
  name="country"
  options={[
    { value: "Tunisia", label: "Tunisia" },
    { value: "Algeria", label: "Algeria" },
  ]}
  register={register}
  error={errors.country}
  required
/>
```

**Props:**
- `label` - Label text
- `name` - Field name
- `options` - Array of `{ value, label }` objects
- `register` - React Hook Form register function
- `error` - Field error object
- `required` - Shows red asterisk if true
- `className` - Optional additional classes

---

### FormTextarea
Textarea component with validation.

**Usage:**
```tsx
import { FormTextarea } from "@/components/forms";

<FormTextarea
  label="Order Notes"
  name="orderNotes"
  placeholder="Add any special instructions"
  rows={4}
  register={register}
  error={errors.orderNotes}
/>
```

**Props:**
- `label` - Label text
- `name` - Field name
- `placeholder` - Placeholder text
- `rows` - Number of rows (default: 4)
- `register` - React Hook Form register function
- `error` - Field error object
- `required` - Shows red asterisk if true
- `className` - Optional additional classes

---

## Styling

All form components include:
- ✅ Black text color
- ✅ Light gray (#C9C9C9) placeholder
- ✅ Red border on validation errors
- ✅ Error message display below field
- ✅ Focus ring on interaction
- ✅ Consistent Tailwind styling

---

## Example: Complete Form

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormInput, FormSelect, FormTextarea } from "@/components/forms";
import { mySchema } from "@/lib/schemas/my-schema";

function MyForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(mySchema),
  });

  const onSubmit = (data) => {
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormInput
        label="Name"
        name="name"
        register={register}
        error={errors.name}
        required
      />
      
      <FormSelect
        label="Country"
        name="country"
        options={countries}
        register={register}
        error={errors.country}
      />
      
      <FormTextarea
        label="Comments"
        name="comments"
        register={register}
        error={errors.comments}
      />
      
      <button type="submit">Submit</button>
    </form>
  );
}
```

---

## Related Files

- **Validation Schemas:** `/lib/schemas/`
- **Usage Example:** `/app/[locale]/checkout/page.tsx`


