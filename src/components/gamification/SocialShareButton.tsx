import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Check, Copy } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface SocialShareButtonProps {
  text: string;
  emoji?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
  className?: string;
}

const SITE_URL = "https://techlanditalia.lovable.app";

export function SocialShareButton({
  text,
  emoji = "🏆",
  variant = "outline",
  size = "sm",
  className = "",
}: SocialShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareText = `${emoji} ${text}\n\n🚀 Impara a programmare con TechLand!\n${SITE_URL}`;

  const shareWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      "_blank"
    );
  };

  const shareFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE_URL)}&quote=${encodeURIComponent(shareText)}`,
      "_blank"
    );
  };

  const copyForInstagram = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast.success("Testo copiato! Incollalo su Instagram 📸");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossibile copiare il testo");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">Condividi</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuItem onClick={shareWhatsApp} className="gap-2 cursor-pointer">
          <span className="text-lg">💬</span>
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareFacebook} className="gap-2 cursor-pointer">
          <span className="text-lg">📘</span>
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyForInstagram} className="gap-2 cursor-pointer">
          {copied ? (
            <Check className="w-4 h-4 text-primary" />
          ) : (
            <span className="text-lg">📸</span>
          )}
          {copied ? "Copiato!" : "Copia per Instagram"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
