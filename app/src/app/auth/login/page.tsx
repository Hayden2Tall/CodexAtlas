import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In — CodexAtlas",
  description: "Sign in to your CodexAtlas account",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-primary-700">
            CodexAtlas
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Ancient manuscripts, modern insight
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-center text-lg font-semibold text-gray-900">
            Sign in to your account
          </h2>
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{" "}
          <a
            href="/auth/signup"
            className="font-medium text-primary-700 hover:text-primary-600"
          >
            Sign up
          </a>
        </p>
      </div>
    </main>
  );
}
