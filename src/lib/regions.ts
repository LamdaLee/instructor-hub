export const REGIONS = ["대전", "대구", "부산"];
export const regionRank = (region: string) => {
  const index = REGIONS.indexOf(region);
  return index < 0 ? REGIONS.length : index;
};
