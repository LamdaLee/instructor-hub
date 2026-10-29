export const ORGANIZATIONS = [
  { value: "aSSIST", label: "aSSIST" },
  { value: "LAB4DX", label: "Lab4dx" },
  { value: "CLIPS", label: "CLIPS" },
  { value: "LGE", label: "LGE" },
];
export function orgLabel(value?: string | null): string {
  const aliases: Record<string, string> = { "어시스트": "aSSIST", "랩포디엑스": "Lab4dx", LAB4DX: "Lab4dx", "클립스": "CLIPS", "LG전자": "LGE", "엘지전자": "LGE" };
  return value ? aliases[value] || value : "소속 미등록";
}
