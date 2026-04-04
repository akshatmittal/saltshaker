export function adapterLabel(adapter: GPUAdapter): string | undefined {
  const pieces = [adapter.info.vendor, adapter.info.architecture].filter(Boolean);
  return pieces.length > 0 ? pieces.join(" ") : undefined;
}

export async function yieldToBrowser(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }

    setTimeout(resolve, 0);
  });
}
