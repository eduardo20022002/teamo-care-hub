import { toBlob } from "html-to-image";
import { toast } from "sonner";

interface ShareMilestoneOptions {
  childName: string;
  title: string;
  date: string;
}

/**
 * Captura o nó (card do marco) como PNG e tenta compartilhar via Web Share API
 * com a imagem anexada. Em navegadores sem suporte a compartilhar arquivos,
 * faz download do PNG e ainda oferece o texto pela Web Share / clipboard.
 */
export async function shareMilestoneImage(
  node: HTMLElement | null,
  { childName, title, date }: ShareMilestoneOptions,
): Promise<void> {
  const text = `🎉 ${childName} conquistou: ${title}! Atingido em ${date}. #TEAmo`;
  const fileName = "conquista-teamo.png";

  let blob: Blob | null = null;
  if (node) {
    try {
      blob = await toBlob(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
    } catch {
      blob = null;
    }
  }

  // Caminho 1: compartilhar a imagem como arquivo (mobile moderno)
  if (blob && typeof navigator !== "undefined" && "share" in navigator) {
    const file = new File([blob], fileName, { type: "image/png" });
    const canShareFiles =
      typeof (navigator as any).canShare === "function" &&
      (navigator as any).canShare({ files: [file] });
    if (canShareFiles) {
      try {
        await (navigator as any).share({
          files: [file],
          title: `Conquista: ${title}`,
          text,
        });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return; // usuário cancelou
        // continua para fallback
      }
    }
  }

  // Caminho 2: sem suporte a arquivos — baixa a imagem e compartilha/copia o texto
  if (blob) {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Imagem da conquista baixada!");
    } catch {
      /* segue para texto */
    }
  }

  // Caminho 3: texto via share nativo ou clipboard
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await (navigator as any).share({ title: `Conquista: ${title}`, text });
      return;
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    if (!blob) toast.success("Texto da conquista copiado!");
  } catch {
    if (!blob) toast.error("Não foi possível compartilhar.");
  }
}
