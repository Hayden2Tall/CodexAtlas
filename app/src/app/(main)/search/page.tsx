import { Suspense } from "react";
import { SearchInterface } from "./search-interface";

export const metadata = {
  title: "Search — CodexAtlas",
  description: "Search manuscripts, passages, and translations.",
};

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading search...</div>}>
      <SearchInterface />
    </Suspense>
  );
}
