# Terms and Conditions Page Setup Guide

## Overview
A comprehensive Terms and Conditions page has been created with:
- ✅ StaticHeader at the top
- ✅ Footer at the bottom
- ✅ Professional layout with proper hierarchy
- ✅ Multi-language support (EN, FR, AR)
- ✅ Responsive design for all screen sizes
- ✅ Contact CTA section
- ✅ Last updated date
- ✅ Integrated with footer navigation

## Files Created/Modified

### 1. `/app/[locale]/terms-and-conditions/page.tsx`
- Main Terms and Conditions page
- Supports EN, FR, and AR languages
- Extracts locale from URL pathname
- Fully responsive layout

### 2. `/lib/footer-config.ts` (Modified)
- Updated "Terms & Services" link to "Terms & Conditions"
- Changed href from `/terms` to `/terms-and-conditions`

## Features

### 🎨 Design Elements
- **Hero Section**: Eye-catching header with title, subtitle, and last updated date
- **Clean Layout**: White content card with proper spacing and shadows
- **Typography Hierarchy**: Clear headings and readable body text
- **Brand Colors**: Uses `#7a3b2e` and `#5e2d23` for consistency
- **Contact CTA**: Prominent call-to-action at the bottom
- **Responsive**: Adapts beautifully to mobile and desktop

### 🌍 Multi-Language Support

**English Sections:**
- Terms and Conditions (Introduction)
- Orders and Payments
- Shipping and Delivery
- Returns and Refunds
- Intellectual Property
- Limitation of Liability
- Privacy Policy
- Changes to Terms
- Contact Us

**French Sections:**
- Termes et Conditions
- Commandes et Paiements
- Expédition et Livraison
- Retours et Remboursements
- Propriété Intellectuelle
- Limitation de Responsabilité
- Politique de Confidentialité
- Modifications des Conditions
- Nous Contacter

**Arabic Sections:**
- الشروط والأحكام
- الطلبات والمدفوعات
- الشحن والتسليم
- المرتجعات والمبالغ المستردة
- الملكية الفكرية
- حدود المسؤولية
- سياسة الخصوصية
- التغييرات على الشروط
- اتصل بنا

### 📋 Content Sections

1. **Introduction**: Welcome message and acceptance of terms
2. **Orders and Payments**: Payment methods, pricing, and order acceptance
3. **Shipping and Delivery**: Shipping policies and timeframes
4. **Returns and Refunds**: Return policy and conditions
5. **Intellectual Property**: Copyright and trademark information
6. **Limitation of Liability**: Legal disclaimers and liability limits
7. **Privacy Policy**: Link to privacy practices
8. **Changes to Terms**: Policy update notifications
9. **Contact Information**: Email and phone contact details

## Accessing the Page

### Direct URLs
- English: `http://localhost:3000/en/terms-and-conditions`
- French: `http://localhost:3000/fr/terms-and-conditions`
- Arabic: `http://localhost:3000/ar/terms-and-conditions`

### Via Footer Link
The page is accessible from any page footer under the "Legal" section:
- Click "Terms & Conditions" in the footer
- The middleware automatically adds the locale prefix

## Customization

### Update Content
Edit the `content` object in `/app/[locale]/terms-and-conditions/page.tsx`:

```typescript
const content = {
    en: {
        title: "Your Custom Title",
        subtitle: "Your custom subtitle here",
        sections: {
            intro: {
                title: "Section Title",
                content: [
                    "Paragraph 1",
                    "Paragraph 2",
                    // Add more paragraphs
                ]
            },
            // Add more sections
        }
    },
    // ... other languages
};
```

### Add New Sections
To add a new section:

```typescript
// 1. Add to content object
newSection: {
    title: "New Section Title",
    content: [
        "Paragraph 1",
        "Paragraph 2"
    ]
}

// 2. Add to JSX in the component
<section className="mb-12">
    <h2 className="text-2xl font-bold text-gray-900 mb-4">
        {text.sections.newSection.title}
    </h2>
    {text.sections.newSection.content.map((paragraph, index) => (
        <p key={index} className="text-gray-700 leading-relaxed mb-4">
            {paragraph}
        </p>
    ))}
</section>
```

### Change Colors
Update Tailwind classes:

```tsx
// Primary color (borders, buttons)
className="border-[#7a3b2e]"
className="bg-[#7a3b2e]"

// Hover states
className="hover:bg-[#5e2d23]"

// Text colors
className="text-gray-900"
className="text-gray-700"
```

### Update Contact Information
Change the contact details in each language section:

```typescript
contact: {
    title: "Contact Us",
    content: [
        "If you have any questions...",
        "Email: your-email@example.com",
        "Phone: (+216) XX XXX XXX"
    ]
}
```

### Change Last Updated Date Format
The date automatically updates based on the current date. To change the format, edit:

```tsx
new Date().toLocaleDateString(
    validLocale === 'ar' ? 'ar-TN' : validLocale === 'fr' ? 'fr-FR' : 'en-US',
    { 
        year: 'numeric', 
        month: 'long',  // Can be 'short', 'numeric', or 'long'
        day: 'numeric'  // Can be 'numeric' or '2-digit'
    }
)
```

## Footer Integration

The Terms and Conditions page is now linked in the footer under "Legal":

```typescript
{
    title: "Legal",
    links: [
        { label: "Terms & Conditions", href: "/terms-and-conditions" },
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Shipping Policy", href: "/shipping" },
        { label: "Returns", href: "/returns" }
    ]
}
```

## SEO Considerations

### To Improve SEO (Optional)
Add metadata to the page:

```typescript
export const metadata = {
    title: 'Terms and Conditions | Kachabity',
    description: 'Read our terms and conditions for shopping at Kachabity.',
};
```

## Testing

### Test Checklist
- [ ] Visit `/en/terms-and-conditions` - English content displays
- [ ] Visit `/fr/terms-and-conditions` - French content displays
- [ ] Visit `/ar/terms-and-conditions` - Arabic content displays
- [ ] Click footer link - Navigates to correct page with locale
- [ ] Test on mobile - Layout is responsive
- [ ] Click "Contact Us" button - Opens email client
- [ ] Verify all sections display correctly
- [ ] Check last updated date is current

### Expected Behavior
- StaticHeader appears at the top
- Hero section with title and subtitle
- All content sections display in order
- Contact CTA button works
- Footer appears at the bottom
- Page is responsive on all screen sizes
- Locale switches work correctly

## Future Enhancements

### Suggested Additions
1. **Privacy Policy Page**: Create a similar page for privacy policy
2. **Shipping Policy Page**: Detailed shipping information
3. **Returns Policy Page**: Dedicated returns and refunds page
4. **FAQ Page**: Frequently asked questions
5. **Cookie Policy**: If using cookies
6. **Table of Contents**: Add anchor links for quick navigation
7. **Print Styles**: Add print-friendly CSS
8. **PDF Download**: Option to download as PDF

### Implementation Ideas

#### Table of Contents
```typescript
<div className="sticky top-4 bg-white p-4 rounded-lg shadow-sm mb-8">
    <h3 className="font-semibold mb-3">Table of Contents</h3>
    <ul className="space-y-2 text-sm">
        <li><a href="#intro" className="text-[#7a3b2e] hover:underline">Introduction</a></li>
        <li><a href="#orders" className="text-[#7a3b2e] hover:underline">Orders</a></li>
        // ... more links
    </ul>
</div>
```

#### Back to Top Button
```typescript
<button
    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    className="fixed bottom-8 right-8 bg-[#7a3b2e] text-white p-3 rounded-full shadow-lg"
>
    ↑
</button>
```

## Troubleshooting

**Issue: Page not found (404)**
- Verify the file is at `/app/[locale]/terms-and-conditions/page.tsx`
- Clear Next.js cache: `rm -rf .next` and restart
- Check middleware is working correctly

**Issue: Wrong language displaying**
- Check the URL includes the correct locale (`/en/`, `/fr/`, `/ar/`)
- Verify the locale extraction logic in the component
- Clear browser cache

**Issue: Footer link not working**
- Verify footer-config.ts has the correct href
- Check middleware is redirecting properly
- Ensure the FooterSection component is rendering links correctly

**Issue: Styling looks wrong**
- Verify Tailwind CSS is compiled correctly
- Check for conflicting CSS classes
- Ensure all Tailwind classes are recognized

## Notes
- The page automatically detects locale from the URL
- Content is comprehensive but you should customize it for your business
- All contact information should be updated to match your actual business details
- Consider having a lawyer review the terms before going live
- Update the "Last Updated" date when making significant changes

---

**Created:** October 28, 2025  
**Status:** ✅ Ready for Customization  
**URL Pattern:** `/{locale}/terms-and-conditions`


