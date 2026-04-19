export function TheLine(props: {
  value: number;
  onValueChange?: (val: number) => void;
  disabled?: boolean;
  step?: number;
}) {
  return (
    <div class="flex gap-2">
      <span class="w-12 text-right leading-8 overflow-hidden">
        {-props.value + 50}%
      </span>
      <input
        class="wavelength grow"
        type="range"
        step={(props.step ?? 1).toString()}
        min="-50"
        max="50"
        onInput={(v) => props.onValueChange?.(v.target.valueAsNumber)}
        value={props.value}
        disabled={!props.onValueChange || props.disabled}
      />
      <span class="w-12 text-left leading-8 overflow-hidden">
        {props.value + 50}%
      </span>
    </div>
  );
}
