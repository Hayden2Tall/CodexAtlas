import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Sign Up — CodexAtlas",
  description: "Create your CodexAtlas account",
};

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size={48} />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-primary-700 font-serif">
              CodexAtlas
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Ancient manuscripts, modern insight
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-center text-lg font-semibold text-gray-900">
            Create your account
          </h2>
          <SignupForm />
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <a
            href="/auth/login"
            className="font-medium text-primary-700 hover:text-primary-600"
          >
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
