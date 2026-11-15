import { Icon } from "./Icons";

/** "Secure payment by Stripe" reassurance, shown wherever a guest is about to pay. */
export function SecurePay({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return (
    <div className={`secure-pay${compact ? " is-compact" : ""} ${className}`.trim()}>
      <Icon name="lock" size={compact ? 16 : 20} />
      <p>
        <b>Secure payment by Stripe</b>
        {compact ? (
          <span> · 3-D Secure · we never see your card number</span>
        ) : (
          <span>
            Your card details go straight to Stripe, our payment provider, and are
            protected by 3-D Secure. We never see or store your card number.
          </span>
        )}
      </p>
    </div>
  );
}
