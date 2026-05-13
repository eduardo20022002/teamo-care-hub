import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShareStepper } from "./ShareStepper";
import { ShareContentStep } from "./ShareContentStep";
import { ShareProfessionalStep } from "./ShareProfessionalStep";
import { ShareExpiryStep, type ExpiryHours } from "./ShareExpiryStep";
import { ShareConfirmationStep } from "./ShareConfirmationStep";
import { listAttendanceRecords } from "@/services/attendance.service";
import { listAllDocuments, type UnifiedDocument } from "@/services/documents.service";
import { listProfessionals, createProfessional } from "@/services/professionals.service";
import { useCreateShare, buildPublicShareUrl } from "@/services/sharing.service";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedRecordIds?: string[];
  preSelectedDocChildIds?: string[];
  preSelectedDocRecordIds?: string[];
  preSelectedProfessionalId?: string;
}

type Step = 1 | 2 | 3 | 4;

export function ShareDialog({
  open,
  onOpenChange,
  preSelectedRecordIds,
  preSelectedDocChildIds,
  preSelectedDocRecordIds,
  preSelectedProfessionalId,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const createShareFn = useCreateShare();

  const [step, setStep] = useState<Step>(1);
  const [recordIds, setRecordIds] = useState<Set<string>>(new Set());
  const [docChildIds, setDocChildIds] = useState<Set<string>>(new Set());
  const [docRecordIds, setDocRecordIds] = useState<Set<string>>(new Set());
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<ExpiryHours>(24);
  const [result, setResult] = useState<{
    token: string;
    expiresAt: string;
    professionalName: string;
  } | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setRecordIds(new Set(preSelectedRecordIds ?? []));
      setDocChildIds(new Set(preSelectedDocChildIds ?? []));
      setDocRecordIds(new Set(preSelectedDocRecordIds ?? []));
      setProfessionalId(preSelectedProfessionalId ?? null);
      setExpiry(24);
      setResult(null);
    }
  }, [
    open,
    preSelectedRecordIds,
    preSelectedDocChildIds,
    preSelectedDocRecordIds,
    preSelectedProfessionalId,
  ]);

  const recordsQuery = useQuery({
    queryKey: ["attendance"],
    queryFn: listAttendanceRecords,
    enabled: open,
  });
  const docsQuery = useQuery({
    queryKey: ["documents-all"],
    queryFn: listAllDocuments,
    enabled: open,
  });
  const profsQuery = useQuery({
    queryKey: ["professionals"],
    queryFn: listProfessionals,
    enabled: open,
  });

  const totalSelected = recordIds.size + docChildIds.size + docRecordIds.size;

  const toggleRecord = (id: string) => {
    setRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleDoc = (d: UnifiedDocument) => {
    if (d.source === "child") {
      setDocChildIds((prev) => {
        const next = new Set(prev);
        if (next.has(d.id)) next.delete(d.id);
        else next.add(d.id);
        return next;
      });
    } else {
      setDocRecordIds((prev) => {
        const next = new Set(prev);
        if (next.has(d.id)) next.delete(d.id);
        else next.add(d.id);
        return next;
      });
    }
  };

  const createProfMutation = useMutation({
    mutationFn: (input: { name: string; specialty: string; email: string }) =>
      createProfessional(user!.id, { ...input, phone: "" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["professionals"] }),
  });

  const submitShare = useMutation({
    mutationFn: async () => {
      if (!professionalId) throw new Error("Selecione um profissional.");
      const res = await createShareFn({
        data: {
          professionalId,
          expiresInHours: expiry,
          recordIds: Array.from(recordIds),
          documentRecordIds: Array.from(docRecordIds),
          documentChildIds: Array.from(docChildIds),
        },
      });
      return res;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["shares"] });
      const prof = profsQuery.data?.find((p) => p.id === professionalId);
      setResult({
        token: res.token,
        expiresAt: res.expiresAt,
        professionalName: prof?.name ?? "o profissional",
      });
      setStep(4);
      toast.success("Compartilhamento criado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canNext = useMemo(() => {
    if (step === 1) return totalSelected > 0;
    if (step === 2) return !!professionalId;
    return true;
  }, [step, totalSelected, professionalId]);

  const handleClose = () => onOpenChange(false);
  const handleNext = () => {
    if (step < 3) setStep(((step + 1) as Step));
    else if (step === 3) submitShare.mutate();
  };
  const handleBack = () => {
    if (step > 1 && step < 4) setStep(((step - 1) as Step));
  };

  const url = result ? buildPublicShareUrl(result.token) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar com profissional</DialogTitle>
          <DialogDescription>
            Gere um link seguro com prazo. O profissional confirma o acesso com um código de 6
            dígitos enviado para o e-mail dele.
          </DialogDescription>
        </DialogHeader>

        <ShareStepper step={step} />

        <div className="min-h-[280px]">
          {step === 1 && (
            <ShareContentStep
              records={recordsQuery.data ?? []}
              documents={docsQuery.data ?? []}
              selectedRecordIds={recordIds}
              selectedDocChildIds={docChildIds}
              selectedDocRecordIds={docRecordIds}
              onToggleRecord={toggleRecord}
              onToggleDoc={toggleDoc}
            />
          )}
          {step === 2 && (
            <ShareProfessionalStep
              professionals={profsQuery.data ?? []}
              selectedId={professionalId}
              onSelect={setProfessionalId}
              onCreate={(input) => createProfMutation.mutateAsync(input)}
            />
          )}
          {step === 3 && <ShareExpiryStep value={expiry} onChange={setExpiry} />}
          {step === 4 && result && (
            <ShareConfirmationStep
              url={url}
              professionalName={result.professionalName}
              expiresAt={result.expiresAt}
              onClose={handleClose}
            />
          )}
        </div>

        {step !== 4 && (
          <DialogFooter className="flex-row justify-between gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={step === 1 ? handleClose : handleBack}
              disabled={submitShare.isPending}
            >
              {step === 1 ? "Cancelar" : "Voltar"}
            </Button>
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canNext || submitShare.isPending}
            >
              {submitShare.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {step === 3 ? "Gerar link" : "Avançar"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
