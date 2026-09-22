export interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'danger';
  action?: { label: string; onClick: () => void };
}

let nextId = 1;

class ToastStore {
  items = $state<Toast[]>([]);

  push(message: string, opts: { tone?: Toast['tone']; action?: Toast['action']; timeoutMs?: number } = {}) {
    const id = nextId++;
    this.items.push({ id, message, tone: opts.tone ?? 'default', action: opts.action });
    setTimeout(() => this.dismiss(id), opts.timeoutMs ?? 4000);
    return id;
  }

  dismiss(id: number) {
    this.items = this.items.filter((t) => t.id !== id);
  }
}

export const toast = new ToastStore();
