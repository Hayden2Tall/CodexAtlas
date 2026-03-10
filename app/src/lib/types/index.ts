export type { Database, Json } from "./database";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

import type { Database } from "./database";

export type Manuscript = Tables<"manuscripts">;
export type ManuscriptImage = Tables<"manuscript_images">;
export type Passage = Tables<"passages">;
export type Translation = Tables<"translations">;
export type TranslationVersion = Tables<"translation_versions">;
export type Variant = Tables<"variants">;
export type VariantReading = Tables<"variant_readings">;
export type VariantComparison = Tables<"variant_comparisons">;
export type ManuscriptLineage = Tables<"manuscript_lineage">;
export type Review = Tables<"reviews">;
export type ReviewCluster = Tables<"review_clusters">;
export type EvidenceRecord = Tables<"evidence_records">;
export type User = Tables<"users">;
export type ResearchPackage = Tables<"research_packages">;
export type AuditLogEntry = Tables<"audit_log">;
export type AgentTask = Tables<"agent_tasks">;

export type UserRole = "reader" | "reviewer" | "scholar" | "editor" | "admin";
export type TranslationMethod =
  | "ai_initial"
  | "ai_revised"
  | "human"
  | "hybrid";
export type TranslationStatus =
  | "draft"
  | "published"
  | "superseded"
  | "disputed";
export type ReviewStatus =
  | "submitted"
  | "acknowledged"
  | "incorporated"
  | "disputed";
export type ConsensusDirection =
  | "approve"
  | "revise"
  | "dispute"
  | "insufficient";
export type RelationshipType =
  | "copy"
  | "derivative"
  | "shared_source"
  | "hypothetical";
export type TranscriptionMethod = "manual" | "ocr_auto" | "ocr_reviewed";
export type OcrStatus = "pending" | "processing" | "completed" | "failed";
export type AgentTaskType =
  | "batch_translate"
  | "discover_manuscript"
  | "ocr_process"
  | "detect_variants"
  | "custom";
export type AgentTaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
