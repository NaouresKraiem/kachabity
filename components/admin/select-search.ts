/**
 * filterOption for admin Selects whose options carry a `searchtext` prop (the name a person
 * would type). antd's default search matches the option value, which is an id here.
 */
export function searchByText(input: string, option?: { searchtext?: string }): boolean {
    return (option?.searchtext ?? "").toLowerCase().includes(input.trim().toLowerCase());
}
