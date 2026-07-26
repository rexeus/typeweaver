export type ApiTagDefinition = {
  readonly name: string;
  readonly description?: string;
};

export type ApiMetadataDefinition = {
  readonly title: string;
  readonly version: string;
  readonly description?: string;
  readonly tags?: readonly ApiTagDefinition[];
};
