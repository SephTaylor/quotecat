// lib/contractEvents.ts
// Lightweight emitter for "this contract just changed" signals.
//
// useFocusEffect on the contract edit screen is unreliable when navigation
// back is initiated from inside an Alert.alert button callback (e.g. after
// the contractor saves a signature and we prompt "Send now?"). The focus
// event can fire before the alert dismissal cycle completes, and the
// downstream getContractWithSignatures() then sees pre-mutation cache state.
//
// This emitter is a side-channel: any code path that mutates a contract
// (signing, reverting, sending) calls notifyContractChanged(id), and the
// edit screen subscribes via onContractChanged() to force a reload.

type Listener = (contractId: string) => void;

const listeners: Set<Listener> = new Set();

export function onContractChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyContractChanged(contractId: string): void {
  listeners.forEach((l) => {
    try {
      l(contractId);
    } catch (e) {
      console.error("contractChanged listener error:", e);
    }
  });
}
