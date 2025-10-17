// modules/core/ui/MoneyInput.tsx
import React, { useState } from "react";
import { TextInput, TextInputProps } from "react-native";

type Props = Omit<TextInputProps, "value" | "onChangeText" | "keyboardType"> & {
  value: number | undefined;
  onChangeValue: (n: number) => void;
  decimals?: number; // default 2
};

const clampNumber = (t: string) => {
  const clean = t.replace(",", ".").replace(/[^0-9.]/g, "");
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
};

export default function MoneyInput({
  value,
  onChangeValue,
  decimals = 2,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);

  const display = focused
    ? (value ?? 0).toString()
    : (value ?? 0).toFixed(decimals);

  return (
    <TextInput
      {...rest}
      value={display}
      keyboardType="decimal-pad"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChangeText={(t) => onChangeValue(clampNumber(t))}
    />
  );
}
