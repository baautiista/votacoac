import { z } from 'zod';

// Defines the shape of a single vote that the flow will receive.
export const VoteSchema = z.object({
  groupName: z.string(),
  category: z.string(),
  votingType: z.string(),
  score: z.number().optional().default(0),
  apto: z.boolean().optional(),
});

export const CarnavalWrappedInputSchema = z.object({
  votes: z.array(VoteSchema).describe("A list of all votes cast by the user."),
});
export type CarnavalWrappedInput = z.input<typeof CarnavalWrappedInputSchema>;

const TopGroupSchema = z.object({
  rank: z.number(),
  name: z.string(),
});

export const CarnavalWrappedOutputSchema = z.object({
  favoriteCategory: z.string().describe("The user's most voted-for category based on the number of votes. 'Ninguna' if none."),
  favoriteChirigota: z.string().describe("The user's most voted-for Chirigota. 'Ninguna' if none."),
  favoriteComparsa: z.string().describe("The user's most voted-for Comparsa. 'Ninguna' if none."),
  favoriteCoro: z.string().describe("The user's most voted-for Coro. 'Ninguno' if none."),
  favoriteCuarteto: z.string().describe("The user's most voted-for Cuarteto. 'Ninguno' if none."),
  topTipo: z.string().describe("The group that received the user's highest 'Aguja de Oro' score. 'Ninguno' if no votes."),
  top3Groups: z.array(TopGroupSchema).describe("A list of the user's top 3 groups based on their 'Normal' vote scores."),
  top3Coros: z.array(TopGroupSchema).describe("Top 3 Coros by score."),
  top3Comparsas: z.array(TopGroupSchema).describe("Top 3 Comparsas by score."),
  top3Chirigotas: z.array(TopGroupSchema).describe("Top 3 Chirigotas by score."),
  top3Cuartetos: z.array(TopGroupSchema).describe("Top 3 Cuartetos by score."),
});
export type CarnavalWrappedOutput = z.infer<typeof CarnavalWrappedOutputSchema>;
