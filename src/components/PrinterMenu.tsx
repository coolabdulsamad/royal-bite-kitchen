import { useEffect, useRef, useState } from "react";
import { Bluetooth, Cable, Loader2, Printer, X } from "lucide-react";
import { printerManager, usePrinter } from "@/lib/printing/printer";

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 py-2 text-left"
    >
      <span>
        <span className="block text-xs text-royal-cream">{label}</span>
        {hint && <span className="mt-0.5 block text-[10px] text-royal-dim/70">{hint}</span>}
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
          checked ? "border-royal-accent bg-royal-accent/80" : "border-royal-line bg-royal-faint/40"
        }`}
      >
        <span
          className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-royal-cream transition-all ${
            checked ? "left-[18px]" : "left-[3px]"
          }`}
        />
      </span>
    </button>
  );
}

export function PrinterMenu() {
  const printer = usePrinter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const modeLabel = printer.direct
    ? printer.direct.kind === "usb"
      ? `USB · ${printer.direct.label}`
      : `Bluetooth · ${printer.direct.label}`
    : "Browser printing";

  async function run(action: () => Promise<unknown>, success: string) {
    setNotice(null);
    printerManager.clearError();
    try {
      await action();
      setNotice(success);
    } catch {
      // lastError already set by the manager
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={`Printer — ${modeLabel}`}
        aria-label="Printer settings"
        className={`relative p-2 transition-colors hover:text-royal-accent ${
          printer.direct ? "text-royal-accent" : "text-royal-dim"
        }`}
      >
        <Printer className="h-4 w-4" strokeWidth={1.75} />
        {printer.direct && (
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 border border-royal-line bg-royal-bgsoft shadow-[0_16px_50px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between border-b border-royal-line px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-royal-accent">
              Receipt printer
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 text-royal-dim hover:text-royal-cream"
              aria-label="Close printer settings"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="px-4 py-3">
            {/* Status */}
            <div className="flex items-center gap-2 border border-royal-line/70 px-3 py-2.5">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  printer.direct ? "bg-emerald-400" : "bg-royal-dim/60"
                }`}
              />
              <p className="truncate text-xs text-royal-cream">{modeLabel}</p>
              {printer.busy && (
                <Loader2 className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin text-royal-dim" />
              )}
            </div>

            {/* Connect / disconnect */}
            <div className="mt-3 flex gap-2">
              {printer.direct ? (
                <button
                  type="button"
                  onClick={() => printerManager.disconnectDirect()}
                  className="flex-1 border border-royal-line py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-royal-dim transition-colors hover:border-rose-500/60 hover:text-rose-400"
                >
                  Disconnect
                </button>
              ) : (
                <>
                  {printer.usbSupported && (
                    <button
                      type="button"
                      disabled={printer.busy}
                      onClick={() =>
                        run(() => printerManager.connectUsb(), "USB printer connected.")
                      }
                      className="flex flex-1 items-center justify-center gap-1.5 border border-royal-line py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-royal-cream transition-colors hover:border-royal-accent hover:text-royal-accent disabled:opacity-40"
                    >
                      <Cable className="h-3.5 w-3.5" strokeWidth={1.75} />
                      USB
                    </button>
                  )}
                  {printer.bleSupported && (
                    <button
                      type="button"
                      disabled={printer.busy}
                      onClick={() =>
                        run(() => printerManager.connectBle(), "Bluetooth printer connected.")
                      }
                      className="flex flex-1 items-center justify-center gap-1.5 border border-royal-line py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-royal-cream transition-colors hover:border-royal-accent hover:text-royal-accent disabled:opacity-40"
                    >
                      <Bluetooth className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Bluetooth
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                disabled={printer.busy}
                onClick={() =>
                  run(
                    () => printerManager.printTestTicket(),
                    printer.direct ? "Test ticket sent." : "Opened browser print.",
                  )
                }
                className="flex-1 border border-royal-line py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-royal-cream transition-colors hover:border-royal-accent hover:text-royal-accent disabled:opacity-40"
              >
                Test ticket
              </button>
            </div>

            {!printer.usbSupported && !printer.bleSupported && !printer.direct && (
              <p className="mt-3 text-[10px] leading-relaxed text-royal-dim/80">
                This browser can't talk to printers directly — receipts print through
                the browser's print dialog. Use Chrome or Edge for USB/Bluetooth printers.
              </p>
            )}

            {/* Settings */}
            <div className="mt-3 border-t border-royal-line/70 pt-2">
              <Toggle
                label="Auto-print after each sale"
                checked={printer.settings.autoPrint}
                onChange={(v) => printerManager.updateSettings({ autoPrint: v })}
              />
              <Toggle
                label="Plain money text (NGN)"
                hint="For printers that garble the ₦ symbol"
                checked={printer.settings.asciiMoney}
                onChange={(v) => printerManager.updateSettings({ asciiMoney: v })}
              />
              <div className="flex items-center justify-between gap-3 py-2">
                <span className="text-xs text-royal-cream">Paper width</span>
                <div className="flex gap-1">
                  {([48, 32] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => printerManager.updateSettings({ width: w })}
                      className={`border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                        printer.settings.width === w
                          ? "border-royal-accent text-royal-accent"
                          : "border-royal-line text-royal-dim hover:text-royal-cream"
                      }`}
                    >
                      {w === 48 ? "80mm" : "58mm"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {(notice || printer.lastError) && (
              <p
                className={`mt-3 border-l-2 px-3 py-2 text-xs ${
                  printer.lastError
                    ? "border-rose-500/70 bg-rose-500/10 text-rose-300"
                    : "border-emerald-500/70 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                {printer.lastError ?? notice}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
