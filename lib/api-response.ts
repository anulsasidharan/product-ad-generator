export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { success: false, error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }

  return Response.json(
    { success: false, error: "Internal server error", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}
