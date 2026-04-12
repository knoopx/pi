/** Base configuration for split panel dimensions calculation */
export function createBaseDimensionsConfig(
  leftFocus: boolean,
  rightFocus = false,
): {
  leftTitle: string;
  rightTitle: string;
  helpText: string;
  leftFocus: boolean;
  rightFocus: boolean;
} {
  return {
    leftTitle: "",
    rightTitle: "",
    helpText: "",
    leftFocus,
    rightFocus,
  };
}
