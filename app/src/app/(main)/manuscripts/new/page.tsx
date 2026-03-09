import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ManuscriptForm } from "./manuscript-form";

export const metadata = {
  title: "New Manuscript — CodexAtlas",
};

export default async function NewManuscriptPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-8 font-serif text-3xl font-bold text-primary-900">
        Add Manuscript
      </h1>
      <ManuscriptForm />
    </div>
  );
}
