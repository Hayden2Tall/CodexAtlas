"use client";

import { BulkTranslateTrigger } from "@/components/admin/bulk-translate-trigger";

interface Props {
  untranslatedPassages: { id: string; reference: string }[];
  totalManuscripts: number;
}

export function ChapterAdminBar({ untranslatedPassages, totalManuscripts }: Props) {
  if (untranslatedPassages.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-amber-800">
          <span className="font-medium">{untranslatedPassages.length}</span> of{" "}
          <span className="font-medium">{totalManuscripts}</span> manuscript
          {totalManuscripts !== 1 ? "s" : ""} in this chapter have no published translation.
        </p>
        <BulkTranslateTrigger
          passages={untranslatedPassages}
          label="for this chapter"
          size="sm"
        />
      </div>
    </div>
  );
}
