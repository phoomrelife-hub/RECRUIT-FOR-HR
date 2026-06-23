// Fixed single-room office for the AI Assistant (no editor).
export const ASSISTANT_NAME = "ผู้ช่วย";
export const ASSISTANT_COLOR = "#5b6cff";

export interface OfficeLayout {
  cols: number;
  rows: number;
  tiles: number[];     // 0 floor, 1 wall, 2 carpet
  desk: { x: number; y: number };
  seat: { x: number; y: number };  // tile the assistant sits on (faces the desk above)
}

function build(): OfficeLayout {
  const cols = 12, rows = 8;
  const tiles = new Array(cols * rows).fill(0);
  for (let x = 0; x < cols; x++) { tiles[x] = 1; tiles[(rows - 1) * cols + x] = 1; }
  for (let y = 0; y < rows; y++) { tiles[y * cols] = 1; tiles[y * cols + (cols - 1)] = 1; }
  // a carpet patch under the workspace
  for (let y = 3; y <= 5; y++) for (let x = 5; x <= 7; x++) tiles[y * cols + x] = 2;
  return { cols, rows, tiles, desk: { x: 6, y: 3 }, seat: { x: 6, y: 4 } };
}

export const OFFICE: OfficeLayout = build();
