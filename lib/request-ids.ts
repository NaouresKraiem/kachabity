/** Ids from `?ids=a,b,c` (bulk actions) or `?id=a`. Bulk actions use one statement, so they apply to all or none. */
export function idsFromSearchParams(searchParams: URLSearchParams): string[] {
    return (searchParams.get('ids') ?? searchParams.get('id') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
}
