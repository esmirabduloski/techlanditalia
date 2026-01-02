import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';

interface TrackedButtonProps extends ButtonProps {
  trackingId: string;
  trackingLabel?: string;
}

/**
 * A Button wrapper that automatically includes tracking data attributes
 * for analytics. Use this for important CTAs that need to be tracked.
 * 
 * Example:
 * <TrackedButton trackingId="hero_cta" trackingLabel="Prenota Lezione">
 *   Prenota Lezione Gratuita
 * </TrackedButton>
 */
export const TrackedButton = React.forwardRef<HTMLButtonElement, TrackedButtonProps>(
  ({ trackingId, trackingLabel, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        data-track-cta={trackingId}
        data-track-label={trackingLabel || (typeof children === 'string' ? children : trackingId)}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

TrackedButton.displayName = 'TrackedButton';
