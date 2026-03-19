import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminDashboard } from "./admin-dashboard";
import type { User, AgentTask, Manuscript, Passage } from "@/lib/types";

export const metadata = {
  title: "Admin Dashboard — CodexAtlas",
};

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Sign in required</h1>
        <p className="mt-2 text-gray-600">
          You must be signed in to access the admin dashboard.
        </p>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single<Pick<User, "role">>();

  if (!profile || !["admin", "editor", "contributor"].includes(profile.role)) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Access denied</h1>
        <p className="mt-2 text-gray-600">
          Contributor role or above required. Current role:{" "}
          <span className="font-mono text-sm">{profile?.role ?? "none"}</span>
        </p>
      </div>
    );
  }

  const admin = createAdminClient();

  const [
    { count: manuscriptCount },
    { count: passageCount },
    { count: translationCount },
    { count: reviewCount },
    { data: recentTasks },
    { data: manuscriptList },
    { data: passageList },
  ] = await Promise.all([
    admin.from("manuscripts").select("*", { count: "exact", head: true }),
    admin.from("passages").select("*", { count: "exact", head: true }),
    admin.from("translations").select("*", { count: "exact", head: true }),
    admin.from("reviews").select("*", { count: "exact", head: true }),
    admin
      .from("agent_tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<AgentTask[]>(),
    admin
      .from("manuscripts")
      .select("id, title, original_language")
      .order("title")
      .returns<Pick<Manuscript, "id" | "title" | "original_language">[]>(),
    admin
      .from("passages")
      .select("id, reference, manuscript_id, manuscripts!inner(title)")
      .not("original_text", "is", null)
      .order("reference")
      .returns<(Pick<Passage, "id" | "reference" | "manuscript_id"> & { manuscripts: { title: string } })[]>(),
  ]);

  const stats = {
    manuscripts: manuscriptCount ?? 0,
    passages: passageCount ?? 0,
    translations: translationCount ?? 0,
    reviews: reviewCount ?? 0,
  };

  const passagesForVariants = (passageList ?? []).map((p) => ({
    id: p.id,
    reference: p.reference,
    manuscript_id: p.manuscript_id,
    manuscript_title: p.manuscripts.title,
  }));

  return (
    <AdminDashboard
      stats={stats}
      initialTasks={recentTasks ?? []}
      manuscripts={manuscriptList ?? []}
      passagesForVariants={passagesForVariants}
      userRole={profile.role}
    />
  );
}
