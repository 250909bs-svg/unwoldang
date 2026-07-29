import { describe, expect, it } from 'vitest';
import { createEmptyReunionContext } from './types';
import { evaluateReunionSafety } from './safetyGate';

function eligibleContext() {
  const context = createEmptyReunionContext('2026-07-21');
  context.adultConfirmed = true;
  context.dataUseConsent = true;
  context.dataAuthorityConfirmed = true;
  context.facts.blockState = 'none';
  context.readiness = {
    accountabilityTaken: true,
    breakupCauseChanged: true,
    canAcceptNoReply: true,
    canRespectBoundary: true,
    supportAvailable: true,
    level: 'ready'
  };
  return context;
}

describe('evaluateReunionSafety', () => {
  it('blocks analysis and all contact guidance for violence or threats', () => {
    const context = eligibleContext();
    context.safety.violence = true;

    const result = evaluateReunionSafety(context);

    expect(result.status).toBe('ANALYSIS_BLOCKED');
    expect(result.timingAllowed).toBe(false);
    expect(result.messageScriptAllowed).toBe(false);
    expect(result.reasonCodes).toContain('VIOLENCE');
  });

  it('prohibits contact when the other person explicitly requested no contact', () => {
    const context = eligibleContext();
    context.safety.explicitNoContact = true;

    const result = evaluateReunionSafety(context);

    expect(result.status).toBe('CONTACT_PROHIBITED');
    expect(result.contactAdviceAllowed).toBe(false);
    expect(result.reasonCodes).toContain('EXPLICIT_NO_CONTACT');
  });

  it('treats active blocking as a boundary even without another safety checkbox', () => {
    const context = eligibleContext();
    context.facts.blockState = 'partner-blocked';

    const result = evaluateReunionSafety(context);

    expect(result.status).toBe('CONTACT_PROHIBITED');
    expect(result.reasonCodes).toContain('ACTIVE_BLOCK');
  });

  it('requires preparation when the breakup cause is unchanged', () => {
    const context = eligibleContext();
    context.facts.repeatedCause = true;
    context.readiness.breakupCauseChanged = false;

    const result = evaluateReunionSafety(context);

    expect(result.status).toBe('PREPARATION_REQUIRED');
    expect(result.timingAllowed).toBe(false);
    expect(result.reasonCodes).toContain('REPEATED_CAUSE_UNCHANGED');
  });

  it('allows only a conditional contact review when every boundary condition passes', () => {
    const result = evaluateReunionSafety(eligibleContext());

    expect(result.status).toBe('CONTACT_ELIGIBLE');
    expect(result.timingAllowed).toBe(true);
    expect(result.messageScriptAllowed).toBe(true);
  });
});
