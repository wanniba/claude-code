// Stub for @ant/computer-use-swift (private Anthropic package, macOS-only native module)
export type ComputerUseAPI = {
  captureScreen: () => Promise<Buffer>;
  captureRegion: (x: number, y: number, w: number, h: number) => Promise<Buffer>;
  listInstalledApps: () => Promise<string[]>;
  resolvePrepareCapture: () => Promise<void>;
  mouseMove: (x: number, y: number) => Promise<void>;
  mouseClick: (x: number, y: number, button?: string) => Promise<void>;
  keyPress: (key: string) => Promise<void>;
  typeText: (text: string) => Promise<void>;
};
