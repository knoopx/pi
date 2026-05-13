import type { GuardrailsGroup } from "../types";
import generalDefaults from "./general";
import jjDefaults from "./jj";

const defaults: GuardrailsGroup[] = [...generalDefaults, ...jjDefaults];

export default defaults;
