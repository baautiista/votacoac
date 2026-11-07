
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Group } from "@/lib/types";
import { NormalVote } from "./normal-vote";
import { BinaryVote } from "./binary-vote";
import { AdvancedVote } from "./advanced-vote";

interface VotingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  onVoteSuccess: (voteType: string, score: number, details?: unknown) => void;
  votedTypes: string[];
  isSaving?: boolean;
  submissionAvailable?: boolean;
}

export function VotingDialog({ isOpen, onClose, group, onVoteSuccess, votedTypes, isSaving, submissionAvailable = true }: VotingDialogProps) {
  if (!isOpen) return null;

  const hasVotedApto = votedTypes.includes("apto/no apto");
  const hasVotedAdvanced = votedTypes.includes("avanzado");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <span className="mini-label">{group.category}</span>
          <DialogTitle className="auth-title">{group.name}</DialogTitle>
          <DialogDescription>
            Puedes emitir un voto de cada tipo por actuación.
          </DialogDescription>
        </DialogHeader>
        {!submissionAvailable && <p role="status" className="rounded-2xl border border-[#FF7B2E]/40 bg-[#FFEDE0] px-4 py-3 text-sm font-medium text-[#A8460B]">El envío de votos no está disponible temporalmente.</p>}
        <Tabs defaultValue={hasVotedApto ? "advanced" : "apto"} className="w-full pt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="apto" disabled={hasVotedApto}>Apto / No Apto {hasVotedApto && "✔️"}</TabsTrigger>
            <TabsTrigger value="advanced" disabled={hasVotedAdvanced}>Por puntuación {hasVotedAdvanced && "✔️"}</TabsTrigger>
          </TabsList>
          <TabsContent value="apto">
            <BinaryVote disabled={isSaving || !submissionAvailable} onVoteSuccess={(score) => onVoteSuccess("apto/no apto", score)} />
          </TabsContent>
          <TabsContent value="advanced">
            <AdvancedVote disabled={isSaving} canSubmit={submissionAvailable} group={group} onVoteSuccess={(score, details) => onVoteSuccess("avanzado", score, details)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
