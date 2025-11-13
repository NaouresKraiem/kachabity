import { redirect } from 'next/navigation';
import { defaultLanguage } from '@/lib/language-utils';

export default function RootPage() {
  // Redirect to default language
  redirect(`/${defaultLanguage}`);
}