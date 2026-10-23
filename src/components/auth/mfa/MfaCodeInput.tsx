import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

/**
 * Campo per i codici numerici: 6 cifre per l'app di autenticazione, la
 * lunghezza impostata in Supabase Auth per i codici email.
 */
export function MfaCodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus = true,
  length = 6,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  length?: number;
}) {
  return (
    <InputOTP
      maxLength={length}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      aria-label={`Codice a ${length} cifre`}
      containerClassName="justify-center"
    >
      <InputOTPGroup>
        {Array.from({ length }, (_, i) => (
          // oltre 6 caselle quelle da 40px non stanno nella card su telefono
          <InputOTPSlot key={i} index={i} className={length > 6 ? 'w-8 sm:w-10' : undefined} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
