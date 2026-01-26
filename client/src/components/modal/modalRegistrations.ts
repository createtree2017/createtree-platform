import { registerModal } from './ModalRegistry';
import { TestModal } from './TestModal';

export function initializeModalRegistry() {
  registerModal('test', TestModal);
}
