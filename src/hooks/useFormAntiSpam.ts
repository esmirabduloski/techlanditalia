import { useRef, useState } from "react";

/**
 * Hook per anti-spam form pubblici.
 * Fornisce:
 * - formOpenedAt: timestamp ms da inviare al backend (time-trap, blocca submit < 2s)
 * - honeypotProps: spread su un input nascosto chiamato "website"
 * - honeypotValue: valore corrente dell'honeypot (da inviare al backend come `website`)
 *
 * Esempio:
 *   const { formOpenedAt, honeypotProps, honeypotValue } = useFormAntiSpam();
 *   ...
 *   <input {...honeypotProps} />
 *   await invoke({ ...formData, website: honeypotValue, formOpenedAt });
 */
export function useFormAntiSpam() {
  const formOpenedAt = useRef<number>(Date.now()).current;
  const [honeypotValue, setHoneypotValue] = useState("");

  const honeypotProps = {
    type: "text" as const,
    name: "website",
    tabIndex: -1,
    autoComplete: "off",
    "aria-hidden": true,
    value: honeypotValue,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setHoneypotValue(e.target.value),
    style: {
      position: "absolute" as const,
      left: "-9999px",
      top: "-9999px",
      width: "1px",
      height: "1px",
      opacity: 0,
      pointerEvents: "none" as const,
    },
  };

  return { formOpenedAt, honeypotProps, honeypotValue };
}
