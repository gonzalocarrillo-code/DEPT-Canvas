declare module "@cesdk/cesdk-js" {
  interface CreativeEditorSdkFactory {
    create(container: unknown, config: unknown): Promise<unknown>;
  }

  const CreativeEditorSDK: CreativeEditorSdkFactory;
  export default CreativeEditorSDK;
}

interface ImportMeta {
  readonly env?: {
    readonly VITE_CESDK_LICENSE?: string;
    readonly VITE_IMGLY_LOCAL_ASSETS_URL?: string;
    readonly VITE_CESDK_USER_ID?: string;
  };
}

declare module "*.css" {
  const css: string;
  export default css;
}
