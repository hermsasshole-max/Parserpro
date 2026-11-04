import React from 'react';
import { UpgradeProModal } from './UpgradeProModal';
import type { SubscriptionState, UpgradeTriggerReason } from '../utils/subscriptionManager';

export interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: UpgradeTriggerReason;
  currencyCode: string;
  subscriptionState: SubscriptionState;
  onSubscriptionUpdated: (nextState: SubscriptionState) => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  isOpen,
  onClose,
  reason = 'general',
  currencyCode,
  subscriptionState,
  onSubscriptionUpdated,
}) => {
  return (
    <UpgradeProModal
      isOpen={isOpen}
      onClose={onClose}
      reason={reason}
      currencyCode={currencyCode}
      subscriptionState={subscriptionState}
      onSubscriptionUpdated={onSubscriptionUpdated}
    />
  );
};

export default PaywallModal;
