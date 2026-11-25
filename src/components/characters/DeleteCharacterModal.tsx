'use client';

import { useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';

interface DeleteCharacterModalProps {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  characterId: string;
  characterName: string;
  onDeleted: () => void;
}

/**
 * Two-step confirmation modal to permanently delete a character from a campaign.
 */
export function DeleteCharacterModal({
  open,
  onClose,
  campaignId,
  characterId,
  characterName,
  onDeleted,
}: DeleteCharacterModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  function handleClose() {
    if (deleting) return;
    setStep(1);
    setConfirmName('');
    setError(null);
    onClose();
  }

  async function handleConfirmDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlightRef.current || confirmName.trim() !== characterName.trim()) {
      return;
    }

    inFlightRef.current = true;
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/characters/${characterId}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmName }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? 'No s’ha pogut eliminar el personatge.');
        return;
      }

      setStep(1);
      setConfirmName('');
      onClose();
      onDeleted();
    } catch {
      setError('Error de connexió en eliminar el personatge.');
    } finally {
      inFlightRef.current = false;
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        step === 1
          ? `Eliminar personatge · ${characterName}`
          : `Confirmació definitiva · ${characterName}`
      }
      description={
        step === 1
          ? 'Primera confirmació: revisa l’impacte abans de continuar.'
          : 'Segona confirmació: escriu el nom exacte del personatge per completar l’eliminació.'
      }
    >
      {step === 1 ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-[var(--rol-radius-md)] border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] px-3.5 py-3 text-sm text-[var(--rol-status-danger-ink)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold">Aquesta acció és permanent i no es pot desfer.</p>
              <p className="text-xs leading-relaxed">
                S’esborrarà completament la fitxa de <strong>{characterName}</strong>, incloent
                atributs, inventari, conjurs, notes i historial de canvis dins la campanya.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel·lar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                setError(null);
                setStep(2);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Continuar per eliminar
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleConfirmDelete} className="space-y-4">
          <InputField
            label={`Escriu "${characterName}" per confirmar l’eliminació definitiva`}
            htmlFor={`delete-char-confirm-${characterId}`}
            type="text"
            required
            autoFocus
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={characterName}
          />

          {error && (
            <div
              role="alert"
              className="rounded-[var(--rol-radius-md)] border border-[var(--rol-status-danger-border)] bg-[var(--rol-status-danger-bg)] px-3 py-2 text-xs text-[var(--rol-status-danger-ink)]"
            >
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              disabled={deleting}
              onClick={() => {
                setError(null);
                setStep(1);
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Enrere
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" disabled={deleting} onClick={handleClose}>
                Cancel·lar
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={deleting || confirmName.trim() !== characterName.trim()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? 'Eliminant…' : 'Eliminar definitivament'}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
