import { pgTable, serial, timestamp, index, foreignKey, varchar, text, boolean, unique, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// 定义 gen_random_uuid 函数（用于 Drizzle schema）
const gen_random_uuid = () => sql`gen_random_uuid()`;



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const profiles = pgTable("profiles", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	username: varchar({ length: 50 }).notNull(),
	nickname: varchar({ length: 50 }),
	avatarUrl: text("avatar_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	email: varchar({ length: 255 }),
	passwordHash: text("password_hash"),
	passwordSalt: text("password_salt"),
}, (table) => [
	index("profiles_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("profiles_username_idx").using("btree", table.username.asc().nullsLast().op("text_ops")),
	unique("profiles_username_unique").on(table.username),
	unique("profiles_email_key").on(table.email),
]);

export const dreams = pgTable("dreams", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	prompt: text().notNull(),
	imageUrl: text("image_url").notNull(),
	videoUrl: text("video_url"),
	dreamType: varchar("dream_type", { length: 20 }).default('default'),
	artStyle: varchar("art_style", { length: 20 }).default('realistic'),
	isFavorite: boolean("is_favorite").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	collectionId: varchar("collection_id", { length: 36 }),
	sessionId: varchar("session_id", { length: 36 }).references(() => dreamSessions.id, { onDelete: "set null" }),
}, (table) => [
	index("dreams_collection_id_idx").using("btree", table.collectionId.asc().nullsLast().op("text_ops")),
	index("dreams_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("dreams_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("dreams_session_id_idx").using("btree", table.sessionId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "dreams_user_id_profiles_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.collectionId],
			foreignColumns: [dreamCollections.id],
			name: "dreams_collection_id_fkey"
		}).onDelete("set null"),
]);

export const dreamCollections = pgTable("dream_collections", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	title: varchar({ length: 100 }),
	description: text(),
	coverUrl: text("cover_url"),
	hasVideo: boolean("has_video").default(false),
	imageCount: integer("image_count").default(0),
	summary: text(), // AI生成的梦境总结
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("dream_collections_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("dream_collections_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "dream_collections_user_id_fkey"
		}).onDelete("cascade"),
]);

export const dreamSessions = pgTable("dream_sessions", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	title: varchar({ length: 200 }),
	promptHistory: text("prompt_history"),
	imageHistory: text("image_history"),
	latestPrompt: text("latest_prompt"),
	latestImageUrl: text("latest_image_url"),
	imageCount: integer("image_count").default(0),
	status: varchar({ length: 20 }).default('active'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("dream_sessions_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("dream_sessions_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("dream_sessions_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "dream_sessions_user_id_fkey"
		}).onDelete("cascade"),
]);
