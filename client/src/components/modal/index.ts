export { ModalContainer, registerModal, registerLazyModal, unregisterModal, getRegisteredModalIds } from './ModalRegistry';
export { ModalProvider, useModalContext } from '../../contexts/ModalContext';
export { useModal } from '../../hooks/useModal';
export { initializeModalRegistry } from './modalRegistrations';
export type { ModalInstance } from '../../contexts/ModalContext';
