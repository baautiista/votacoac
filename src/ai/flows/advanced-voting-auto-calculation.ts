import { z } from 'zod';

export const AdvancedVotingInputSchema = z.object({
  groupType: z.enum(['Coro', 'Comparsa', 'Chirigota', 'Cuarteto']),
  presentation: z.number().min(0).max(10),
  pasodobles1: z.number().min(0).max(10),
  pasodobles2: z.number().min(0).max(10),
  cuples1: z.number().min(0).max(10),
  cuples2: z.number().min(0).max(10),
  estribillos1: z.number().min(0).max(10),
  estribillos2: z.number().min(0).max(10),
  popurri: z.number().min(0).max(10),
  tipo: z.number().min(0).max(8),
  impresionGeneral: z.number().min(0).max(4),
});
export type AdvancedVotingInput = z.infer<typeof AdvancedVotingInputSchema>;
export type AdvancedVotingOutput = { finalScore: number };

// Coefficients retained from the scoring rules supplied with VotaCOAC.
export async function advancedVotingWithAutoCalculation(input: AdvancedVotingInput): Promise<AdvancedVotingOutput> {
  const v = AdvancedVotingInputSchema.parse(input);
  const cuples = v.cuples1 + v.cuples2;
  const estribillos = v.estribillos1 + v.estribillos2;
  let total: number;

  if (v.groupType === 'Cuarteto') {
    total = v.presentation * 2 * 4.4 + cuples * 3 * 1.2 + estribillos * 3 * 0.3 + v.popurri * 2 * 2;
  } else {
    const chirigota = v.groupType === 'Chirigota';
    total = v.presentation * 3 * 0.6
      + (v.pasodobles1 + v.pasodobles2) * 3 * (chirigota ? 1.2 : 2.2)
      + cuples * 3 * (chirigota ? 1.8 : 0.9)
      + estribillos * 3 * (chirigota ? 0.4 : 0.3)
      + v.popurri * 3 * 2;
  }
  total += v.tipo * 0.5 + v.impresionGeneral * 0.5;
  return { finalScore: Math.round(total * 100) / 100 };
}
