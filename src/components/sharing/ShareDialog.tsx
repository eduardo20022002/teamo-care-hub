import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ShareStepper } from "./ShareStepper";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";
const BRAND_SHADOW =
  "0 8px 18px -8px rgba(79,70,229,0.45), 0 3px 8px -3px rgba(236,72,153,0.25)";
import { ShareContentStep } from "./ShareContentStep";
import { ShareProfessionalStep } from "./ShareProfessionalStep";
import { ShareExpiryStep, type ExpiryHours } from "./ShareExpiryStep";
import { ShareConfirmationStep } from "./ShareConfirmationStep";
import { track } from "@/lib/analytics";
import { listDiaryRecords } from "@/services/attendance.service";
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
    professionalEmail?: string;
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
    queryKey: ["diary-records"],
    queryFn: () => listDiaryRecords(),
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
      track("share.create", { module: "compartilhamento" });
      qc.invalidateQueries({ queryKey: ["shares"] });
      const prof = profsQuery.data?.find((p) => p.id === professionalId);
      setResult({
        token: res.token,
        expiresAt: res.expiresAt,
        professionalName: prof?.name ?? "o profissional",
        professionalEmail: prof?.email ?? undefined,
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-[24px] px-0 pb-0 pt-0"
      >
        <SheetTitle className="sr-only">Compartilhar com profissional</SheetTitle>

        {/* Drag handle */}
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-[#E5E7EB]" />
        </div>

        {/* Header — o X de fechar é o padrão do SheetContent (canto sup. direito) */}
        <div className="px-5 pb-4 pt-3">
          <h2 className="text-[17px] font-bold text-foreground">
            Compartilhar com profissional
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Gere um link seguro com prazo. O profissional confirma o acesso com
            um código de 6 dígitos enviado por e-mail.
          </p>
        </div>

        <div className="h-px bg-[#EEF0F4]" />

        <div className="px-5 pt-4">
          <ShareStepper step={step} />
        </div>

        <div className="min-h-[260px] px-5 py-4">
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
              professionalEmail={result.professionalEmail}
              expiresAt={result.expiresAt}
              onClose={handleClose}
            />
          )}
        </div>

        {step !== 4 && (
          <div className="space-y-3 px-5 pb-8 pt-2">
            <button
              type="button"
              onClick={handleNext}
              disabled={!canNext || submitShare.isPending}
              className="flex h-[50px] w-full items-center justify-center rounded-[12px] text-sm font-semibold text-white disabled:opacity-45"
              style={{
                background: BRAND_GRADIENT,
                boxShadow: canNext && !submitShare.isPending ? BRAND_SHADOW : "none",
              }}
            >
              {submitShare.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : step === 3 ? (
                "Gerar link"
              ) : (
                "Avançar"
              )}
            </button>
            <button
              type="button"
              onClick={step === 1 ? handleClose : handleBack}
              disabled={submitShare.isPending}
              className="w-full py-2 text-sm text-muted-foreground"
            >
              {step === 1 ? "Cancelar" : "Voltar"}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
