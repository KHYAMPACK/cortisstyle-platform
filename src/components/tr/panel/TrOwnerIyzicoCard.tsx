"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  panelDangerBtnClass,
  panelFieldClass,
  panelHintClass,
  panelLabelClass,
  panelPrimaryBtnClass,
  panelSecondaryBtnClass,
  panelSectionClass,
} from "@/components/tr/panel/panelUi";
import { TrPanelBusySpinner } from "@/components/tr/panel/TrPanelMotion";
import { TrPanelConfirmPopover } from "@/components/tr/panel/TrPanelConfirmPopover";
import {
  connectOwnerIyzico,
  disconnectOwnerIyzico,
  fetchOwnerIyzicoStatus,
} from "@/lib/tr/panel/ownerClient";
import { toast } from "@/lib/tr/panel/toast";
import {
  iyzicoStatusLabel,
  NOT_CONNECTED,
  type IyzicoStatus,
} from "@/lib/tr/payments/iyzicoKeys";

interface ViewProps {
  status: IyzicoStatus;
  loading: boolean;
  busy: boolean;
  error: string | null;
  onConnect: (keys: { apiKey: string; secretKey: string }) => Promise<boolean>;
  onDisconnect: () => Promise<void>;
}

/** The card itself, without any data loading: what the owner sees and types. */
export function TrIyzicoCardView({
  status,
  loading,
  busy,
  error,
  onConnect,
  onDisconnect,
}: ViewProps) {
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const showFields = !status.connected || editing;
  const canSubmit = apiKey.trim() !== "" && secretKey.trim() !== "" && !busy;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    const ok = await onConnect({ apiKey, secretKey });
    if (ok) {
      // The keys are not kept in the page once they are stored.
      setApiKey("");
      setSecretKey("");
      setEditing(false);
    }
  };

  return (
    <section className={panelSectionClass}>
      <p className="text-[19px] font-semibold text-neutral-900">Kart ödemesi (iyzico)</p>
      <p className={`mt-2 ${panelHintClass}`}>
        {status.connected
          ? "Müşterileriniz mağazanızda kartla ödeme yapabilir; ödemeler doğrudan kendi iyzico hesabınıza geçer."
          : "Müşterileriniz kartla ödeme yapabilsin diye kendi iyzico üye iş yeri hesabınızı bağlayın. Bağlanana kadar siparişler “ödeme bekliyor” olarak kaydedilir ve ödemeyi elle onaylarsınız."}
      </p>
      <p className="mt-3 text-[16px] font-semibold text-neutral-800">
        Durum:{" "}
        <span style={{ color: "var(--panel-accent-deep)" }}>
          {loading ? "…" : iyzicoStatusLabel(status)}
        </span>
      </p>
      {status.connected && status.mode === "sandbox" ? (
        <p className="mt-3 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          Deneme (sandbox) anahtarları bağlı: gerçek ödeme alınmaz. Canlı anahtarlarınızı girerek
          değiştirin.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-800">
          {error}
        </p>
      ) : null}

      {showFields ? (
        <form onSubmit={submit} className="mt-4 space-y-4" autoComplete="off">
          <div>
            <label className={panelLabelClass} htmlFor="iyzico-api-key">
              API anahtarı
            </label>
            <input
              id="iyzico-api-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="new-password"
              spellCheck={false}
              autoCapitalize="off"
              className={`${panelFieldClass} mt-1 font-mono placeholder:font-sans`}
              placeholder="iyzico panelinizdeki API anahtarı"
            />
          </div>
          <div>
            <label className={panelLabelClass} htmlFor="iyzico-secret-key">
              Güvenlik anahtarı
            </label>
            <input
              id="iyzico-secret-key"
              type="password"
              value={secretKey}
              onChange={(event) => setSecretKey(event.target.value)}
              autoComplete="new-password"
              spellCheck={false}
              autoCapitalize="off"
              className={`${panelFieldClass} mt-1 font-mono placeholder:font-sans`}
              placeholder="iyzico panelinizdeki güvenlik anahtarı (secret key)"
            />
          </div>
          <p className={panelHintClass}>
            iyzico üye iş yeri panelinizde <strong>canlı</strong> (production) API anahtarını ve güvenlik
            anahtarını bulabilirsiniz. Anahtarlar iyzico ile doğrulanır, şifrelenerek saklanır ve bir
            daha gösterilmez.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={!canSubmit} className={`${panelPrimaryBtnClass} gap-3`}>
              {busy ? (
                <>
                  <TrPanelBusySpinner />
                  Doğrulanıyor…
                </>
              ) : status.connected ? (
                "Anahtarları güncelle"
              ) : (
                "Bağla ve doğrula"
              )}
            </button>
            {editing ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setApiKey("");
                  setSecretKey("");
                }}
                className={panelSecondaryBtnClass}
              >
                Vazgeç
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => setEditing(true)}
            className={panelSecondaryBtnClass}
          >
            Anahtarları değiştir
          </button>
          <TrPanelConfirmPopover
            open={confirmOpen}
            message="Kart ödemesi kapatılsın mı? Müşteriler artık kartla ödeyemez."
            confirmLabel="Evet, kaldır"
            cancelLabel="Vazgeç"
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirmOpen(false);
              void onDisconnect();
            }}
          >
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => setConfirmOpen(true)}
              className={panelDangerBtnClass}
            >
              Bağlantıyı kaldır
            </button>
          </TrPanelConfirmPopover>
        </div>
      )}
    </section>
  );
}

/** Ayarlar → Kart ödemesi: connect the store's own iyzico account. */
export function TrOwnerIyzicoCard({ boutiqueId }: { boutiqueId: string }) {
  const [status, setStatus] = useState<IyzicoStatus>(NOT_CONNECTED);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOwnerIyzicoStatus(boutiqueId)
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Ödeme durumu okunamadı.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [boutiqueId]);

  return (
    <TrIyzicoCardView
      status={status}
      loading={loading}
      busy={busy}
      error={error}
      onConnect={async (keys) => {
        setBusy(true);
        setError(null);
        try {
          setStatus(await connectOwnerIyzico(boutiqueId, keys));
          toast.success("iyzico bağlandı. Müşterileriniz artık kartla ödeyebilir.");
          return true;
        } catch (connectError) {
          const message =
            connectError instanceof Error ? connectError.message : "iyzico bağlanamadı.";
          setError(message);
          toast.error(message);
          return false;
        } finally {
          setBusy(false);
        }
      }}
      onDisconnect={async () => {
        setBusy(true);
        setError(null);
        try {
          setStatus(await disconnectOwnerIyzico(boutiqueId));
          toast.success("Kart ödemesi kapatıldı.");
        } catch (disconnectError) {
          const message =
            disconnectError instanceof Error ? disconnectError.message : "Bağlantı kaldırılamadı.";
          setError(message);
          toast.error(message);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
