import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  recoveryHash: text('recovery_hash').notNull(),
  role: text('role').notNull().default('user'),
  createdAt: integer('created_at').notNull(),
}, table => [uniqueIndex('users_email_unique').on(table.email)]);
export const authSessions = sqliteTable('auth_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [index('auth_sessions_user_idx').on(table.userId)]);
export const votes = sqliteTable('votes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  editionId: text('edition_id').notNull(),
  performanceId: text('performance_id').notNull(),
  groupId: text('group_id').notNull(),
  groupName: text('group_name').notNull(),
  category: text('category').notNull(),
  votingType: text('voting_type').notNull(),
  score: real('score').notNull(),
  apto: integer('apto'),
  details: text('details'),
  createdAt: integer('created_at').notNull(),
}, table => [uniqueIndex('votes_one_per_user_performance_type').on(table.userId, table.editionId, table.performanceId, table.votingType), index('votes_edition_type_idx').on(table.editionId, table.votingType), index('votes_edition_performance_idx').on(table.editionId, table.performanceId), index('votes_edition_category_type_idx').on(table.editionId, table.category, table.votingType)]);
export const favorites = sqliteTable('favorites', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  groupId: text('group_id').notNull(),
  editionId: text('edition_id').notNull(),
}, table => [uniqueIndex('favorites_unique').on(table.userId, table.editionId, table.groupId)]);
export const predictions = sqliteTable('predictions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  editionId: text('edition_id').notNull(),
  selection: text('selection').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, table => [uniqueIndex('predictions_user_edition').on(table.userId, table.editionId)]);
export const settings = sqliteTable('settings', { key: text('key').primaryKey(), value: text('value').notNull(), updatedAt: integer('updated_at').notNull() });
export const rateLimits = sqliteTable('rate_limits', { key: text('key').primaryKey(), attempts: integer('attempts').notNull(), resetsAt: integer('resets_at').notNull() });

// Additive expansion. Existing users, sessions, votes, favorites and predictions stay intact.
export const editionCatalogs = sqliteTable('edition_catalogs', { id: text('id').primaryKey(), name: text('name').notNull(), catalog: text('catalog').notNull(), updatedAt: integer('updated_at').notNull() });
export const moduleSettings = sqliteTable('module_settings', { editionId: text('edition_id').primaryKey(), config: text('config').notNull(), revision: integer('revision').notNull().default(1), updatedAt: integer('updated_at').notNull() });
export const memberProfiles = sqliteTable('member_profiles', { userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }), handle: text('handle').notNull(), createdAt: integer('created_at').notNull() }, t => [uniqueIndex('member_handle_unique').on(t.handle)]);
export const phaseForecasts = sqliteTable('phase_forecasts', { id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), editionId: text('edition_id').notNull(), phase: text('phase').notNull(), selection: text('selection').notNull(), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull() }, t => [uniqueIndex('phase_forecast_unique').on(t.userId, t.editionId, t.phase), index('phase_forecast_edition').on(t.editionId, t.phase)]);
export const officialResults = sqliteTable('official_results', { id: text('id').primaryKey(), editionId: text('edition_id').notNull(), phase: text('phase').notNull(), category: text('category').notNull(), groupId: text('group_id').notNull(), position: integer('position'), source: text('source').notNull(), updatedAt: integer('updated_at').notNull() }, t => [uniqueIndex('official_result_unique').on(t.editionId, t.phase, t.groupId), index('official_result_edition_phase').on(t.editionId, t.phase)]);
export const resultPublications = sqliteTable('result_publications', { editionId: text('edition_id').notNull(), phase: text('phase').notNull(), category: text('category').notNull(), source: text('source').notNull(), publishedAt: integer('published_at').notNull() }, t => [uniqueIndex('result_publication_unique').on(t.editionId, t.phase, t.category)]);
export const forecastScores = sqliteTable('forecast_scores', { userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), editionId: text('edition_id').notNull(), phase: text('phase').notNull(), points: integer('points').notNull(), hits: integer('hits').notNull(), exactHits: integer('exact_hits').notNull(), updatedAt: integer('updated_at').notNull() }, t => [uniqueIndex('forecast_score_unique').on(t.userId, t.editionId, t.phase), index('forecast_score_ranking').on(t.editionId, t.phase, t.points)]);
export const privateLeagues = sqliteTable('private_leagues', { id: text('id').primaryKey(), editionId: text('edition_id').notNull(), name: text('name').notNull(), codeHash: text('code_hash').notNull(), ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }), createdAt: integer('created_at').notNull() }, t => [uniqueIndex('league_code_unique').on(t.codeHash)]);
export const leagueMembers = sqliteTable('league_members', { leagueId: text('league_id').notNull().references(() => privateLeagues.id, { onDelete: 'cascade' }), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), joinedAt: integer('joined_at').notNull() }, t => [uniqueIndex('league_members_unique').on(t.leagueId, t.userId)]);
export const precontestSupport = sqliteTable('precontest_support', { userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), editionId: text('edition_id').notNull(), category: text('category').notNull(), groupId: text('group_id').notNull(), updatedAt: integer('updated_at').notNull() }, t => [uniqueIndex('precontest_one_per_category').on(t.userId, t.editionId, t.category), index('precontest_public_counts').on(t.editionId, t.category, t.groupId)]);
export const supportHistory = sqliteTable('support_history', { id: integer('id').primaryKey({ autoIncrement: true }), editionId: text('edition_id').notNull(), category: text('category').notNull(), snapshot: text('snapshot').notNull(), createdAt: integer('created_at').notNull() }, t => [index('support_history_edition_time').on(t.editionId, t.category, t.createdAt)]);
export const bingoCards = sqliteTable('bingo_cards', { id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), editionId: text('edition_id').notNull(), sessionId: text('session_id').notNull(), cells: text('cells').notNull(), marked: text('marked').notNull(), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull() }, t => [uniqueIndex('bingo_card_user_session').on(t.userId, t.editionId, t.sessionId), index('bingo_session').on(t.editionId, t.sessionId)]);
export const bingoEvents = sqliteTable('bingo_events', { editionId: text('edition_id').notNull(), sessionId: text('session_id').notNull(), situationId: text('situation_id').notNull(), occurred: integer('occurred').notNull(), confirmedBy: text('confirmed_by').references(() => users.id, { onDelete: 'set null' }), updatedAt: integer('updated_at').notNull() }, t => [uniqueIndex('bingo_event_unique').on(t.editionId, t.sessionId, t.situationId)]);
export const metricSnapshots = sqliteTable('metric_snapshots', { id: integer('id').primaryKey({ autoIncrement: true }), editionId: text('edition_id').notNull(), performanceId: text('performance_id').notNull(), groupId: text('group_id').notNull(), phase: text('phase').notNull(), metrics: text('metrics').notNull(), createdAt: integer('created_at').notNull() }, t => [index('metric_history_group_phase').on(t.editionId, t.groupId, t.phase, t.createdAt)]);
export const integrationEvents = sqliteTable('integration_events', { id: integer('id').primaryKey({ autoIncrement: true }), editionId: text('edition_id').notNull(), type: text('type').notNull(), entityId: text('entity_id').notNull(), payload: text('payload').notNull(), createdAt: integer('created_at').notNull() }, t => [index('integration_events_edition').on(t.editionId, t.id)]);
export const integrationKeys = sqliteTable('integration_keys', { id: text('id').primaryKey(), label: text('label').notNull(), tokenHash: text('token_hash').notNull(), createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }), createdAt: integer('created_at').notNull(), revokedAt: integer('revoked_at'), lastUsedAt: integer('last_used_at') }, t => [uniqueIndex('integration_key_hash').on(t.tokenHash)]);
export const adminAudit = sqliteTable('admin_audit', { id: text('id').primaryKey(), actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }), action: text('action').notNull(), entity: text('entity').notNull(), before: text('before_data'), after: text('after_data'), reason: text('reason').notNull(), createdAt: integer('created_at').notNull() }, t => [index('audit_time').on(t.createdAt)]);
export const accountModeration = sqliteTable('account_moderation', { userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }), status: text('status').notNull(), reason: text('reason').notNull(), updatedAt: integer('updated_at').notNull() });
