import { CarnavalWrappedInputSchema, CarnavalWrappedOutputSchema, type CarnavalWrappedInput, type CarnavalWrappedOutput } from '@/ai/schemas/carnaval-wrapped';

export async function generateCarnavalWrapped(input: CarnavalWrappedInput): Promise<CarnavalWrappedOutput> {
  const { votes } = CarnavalWrappedInputSchema.parse(input);
  const mostFrequent = (names: string[], fallback: string) => {
    const counts = new Map<string, number>();
    for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))[0]?.[0] ?? fallback;
  };
  const favorite = (category: string, fallback: string) =>
    mostFrequent(votes.filter(v => v.category === category).map(v => v.groupName), fallback);

  // The active voting form records Avanzado votes; Normal is retained for older records.
  const scoredVotes = votes.filter(v => v.votingType === 'Avanzado' || v.votingType === 'Normal');
  const top = (category?: string) => {
    const groups = new Map<string, { total: number; count: number }>();
    for (const vote of scoredVotes.filter(v => !category || v.category === category)) {
      const entry = groups.get(vote.groupName) ?? { total: 0, count: 0 };
      entry.total += vote.score;
      entry.count++;
      groups.set(vote.groupName, entry);
    }
    return [...groups]
      .map(([name, data]) => ({ name, score: data.total / data.count }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'es'))
      .slice(0, 3)
      .map(({ name }, index) => ({ rank: index + 1, name }));
  };

  return CarnavalWrappedOutputSchema.parse({
    favoriteCategory: mostFrequent(votes.map(v => v.category), 'Ninguna'),
    favoriteChirigota: favorite('Chirigota', 'Ninguna'),
    favoriteComparsa: favorite('Comparsa', 'Ninguna'),
    favoriteCoro: favorite('Coro', 'Ninguno'),
    favoriteCuarteto: favorite('Cuarteto', 'Ninguno'),
    topTipo: [...votes].filter(v => v.votingType === 'Aguja de Oro').sort((a, b) => b.score - a.score)[0]?.groupName ?? 'Ninguno',
    top3Groups: top(),
    top3Coros: top('Coro'),
    top3Comparsas: top('Comparsa'),
    top3Chirigotas: top('Chirigota'),
    top3Cuartetos: top('Cuarteto'),
  });
}
