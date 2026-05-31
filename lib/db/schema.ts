import {
  pgTable,
  text,
  jsonb,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

function timestamps() {
  return {
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  };
}

export const offering = pgTable("offering", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  sourceUrl: text("source_url"),
  rawScraped: text("raw_scraped"),
  ...timestamps(),
});

export const prompt = pgTable("prompt", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  ...timestamps(),
});

export const prospect = pgTable(
  "prospect",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    profile: jsonb("profile"),
    enrichmentStatus: text("enrichment_status").notNull().default("pending"),
    ...timestamps(),
  },
  (t) => [index("prospect_user_id_idx").on(t.userId)]
);

export const prospectSource = pgTable("prospect_source", {
  id: text("id").primaryKey(),
  prospectId: text("prospect_id").notNull(),
  type: text("type").notNull(),
  value: text("value"),
  rawExtracted: text("raw_extracted"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conversation = pgTable(
  "conversation",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    prospectId: text("prospect_id").notNull(),
    offeringId: text("offering_id").notNull(),
    promptId: text("prompt_id").notNull(),
    // Branching: a conversation re-toned from a message of another conversation
    parentId: text("parent_id"),
    branchFromMessageId: text("branch_from_message_id"),
    branchTone: text("branch_tone"),
    ...timestamps(),
  },
  (t) => [index("conversation_prospect_id_idx").on(t.prospectId)]
);

export const message = pgTable(
  "message",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    role: text("role").notNull(), // 'assistant' | 'prospect'
    content: text("content").notNull(),
    tone: text("tone"),
    rating: integer("rating"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    // True for prefix messages copied into a branch — kept as generation context
    // but hidden in the branch's UI (they aren't regenerated).
    inherited: boolean("inherited").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("message_conversation_id_idx").on(t.conversationId)]
);
