import Link from "next/link";
import { VariantForm } from "./variant-form";

export const metadata = {
  title: "New Variant — CodexAtlas",
  description: "Create a new textual variant entry.",
};

export default function NewVariantPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/variants" className="hover:text-primary-700">
          Variants
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">New</span>
      </nav>

      <h1 className="mb-6 font-serif text-2xl font-bold text-primary-900">
        Create Variant
      </h1>

      <VariantForm />
    </div>
  );
}
