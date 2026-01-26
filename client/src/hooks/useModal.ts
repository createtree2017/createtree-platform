import { useCallback } from 'react';
import { useModalContext } from '../contexts/ModalContext';

export function useModal() {
  const { openModal, closeTopModal, closeAllModals, isModalOpen, getModalProps, modalStack, getTopModal } = useModalContext();

  const open = useCallback(<T extends Record<string, unknown>>(id: string, props?: T): string => {
    return openModal(id, props || {});
  }, [openModal]);

  const close = useCallback(() => {
    closeTopModal();
  }, [closeTopModal]);

  const closeAll = useCallback(() => {
    closeAllModals();
  }, [closeAllModals]);

  const isOpen = useCallback((id: string) => {
    return isModalOpen(id);
  }, [isModalOpen]);

  const getProps = useCallback(<T extends Record<string, unknown>>(id: string): T | null => {
    return getModalProps<T>(id);
  }, [getModalProps]);

  const hasOpenModals = modalStack.length > 0;
  const topModal = getTopModal();
  const topModalId = topModal?.id || null;
  const topInstanceId = topModal?.instanceId || null;

  return {
    open,
    close,
    closeAll,
    isOpen,
    getProps,
    hasOpenModals,
    topModalId,
    topInstanceId,
    modalStack,
  };
}

export type { ModalInstance } from '../contexts/ModalContext';
