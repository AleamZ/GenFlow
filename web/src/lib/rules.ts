import type { FileNode, NodeType, Rule } from "../types";
import { colorForType } from "../theme";

export interface CompiledRule {
  re: RegExp | null;
  rule: Rule;
}

export function compileRules(rules: Rule[]): CompiledRule[] {
  return rules
    .filter((r) => r.enabled)
    .map((rule) => {
      let re: RegExp | null = null;
      try {
        re = new RegExp(rule.pattern);
      } catch {
        re = null;
      }
      return { re, rule };
    });
}

export interface EffectiveStyle {
  type: NodeType;
  group: string;
  color: string;
}

/** Apply user-defined rules (regex on path) to override type/group/color. */
export function applyRules(node: FileNode, compiled: CompiledRule[]): EffectiveStyle {
  let type = node.type;
  let group = node.group;
  let color: string | undefined;

  for (const { re, rule } of compiled) {
    if (!re || !re.test(node.id)) continue;
    if (rule.setType) type = rule.setType;
    if (rule.setGroup) group = rule.setGroup;
    if (rule.setColor) color = rule.setColor;
  }

  return { type, group, color: color ?? colorForType(type) };
}
