export type RequestSerializationLocation = "header" | "path" | "query";

export type RequestSerializationReason =
  | "invalid-date"
  | "nested-array"
  | "non-finite-number"
  | "null-value"
  | "unsupported-type";

function describeValueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "Date";
  return typeof value;
}

export class RequestSerializationError extends TypeError {
  public readonly code = "REQUEST_SERIALIZATION_ERROR";
  public readonly location: RequestSerializationLocation;
  public readonly key: string;
  public readonly reason: RequestSerializationReason;
  public readonly valueType: string;

  public constructor(
    location: RequestSerializationLocation,
    key: string,
    value: unknown,
    reason: RequestSerializationReason
  ) {
    const valueType = describeValueType(value);
    super(
      `Cannot serialize ${location} value '${key}' (${valueType}): ${reason.replaceAll(
        "-",
        " "
      )}`
    );
    this.name = "RequestSerializationError";
    this.location = location;
    this.key = key;
    this.reason = reason;
    this.valueType = valueType;
  }
}
