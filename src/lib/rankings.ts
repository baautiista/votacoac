import type { PersonalVote, RankingEntry, GroupCategory } from './types';
export function calculateRankings(votes:PersonalVote[]|null,voteType:'Avanzado'|'Apto/No Apto'|'Aguja de Oro'):RankingEntry[] {
 const totals=new Map<string,{totalScore:number;voteCount:number;category:GroupCategory}>();
 for(const vote of votes??[]) {
  if(vote.votingType!==voteType)continue;
  const entry=totals.get(vote.groupName)??{totalScore:0,voteCount:0,category:vote.category};
  entry.totalScore+=voteType==='Apto/No Apto'?(vote.apto?100:0):(vote.score??0);
  entry.voteCount++;
  totals.set(vote.groupName,entry);
 }
 return [...totals].map(([groupName,data])=>({position:0,groupName,category:data.category,averageScore:data.totalScore/data.voteCount,voteCount:data.voteCount})).sort((a,b)=>b.averageScore-a.averageScore).map((v,index)=>({...v,position:index+1}));
}
