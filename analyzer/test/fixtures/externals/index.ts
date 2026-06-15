import fake from "definitely-missing-pkg";
import button from "@acme/widgets/button";
import { x } from "./local";

export const y = x + (fake ? 1 : 0) + (button ? 1 : 0);
