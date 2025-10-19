// lib/errors.ts
// Centralized error handling utilities

import { Alert } from "react-native";

/**
 * Standard error types for the app
 */
export enum ErrorType {
  STORAGE = "STORAGE_ERROR",
  NETWORK = "NETWORK_ERROR",
  VALIDATION = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  UNKNOWN = "UNKNOWN_ERROR",
}

/**
 * Custom error class with type information
 */
export class AppError extends Error {
  type: ErrorType;
  originalError?: Error;

  constructor(type: ErrorType, message: string, originalError?: Error) {
    super(message);
    this.name = "AppError";
    this.type = type;
    this.originalError = originalError;
  }
}

/**
 * Standard result type for async operations
 * Prefer this over throwing errors in many cases
 */
export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Wrap an async operation with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorType: ErrorType = ErrorType.UNKNOWN,
): Promise<Result<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const appError = new AppError(
      errorType,
      error instanceof Error ? error.message : "Unknown error occurred",
      error instanceof Error ? error : undefined,
    );
    return { success: false, error: appError };
  }
}

/**
 * Show user-facing error alert
 */
export function showErrorAlert(
  title: string,
  message: string,
  onDismiss?: () => void,
): void {
  Alert.alert(title, message, [
    {
      text: "OK",
      onPress: onDismiss,
    },
  ]);
}

/**
 * Log error for debugging (can be extended to send to analytics)
 */
export function logError(error: Error | AppError, context?: string): void {
  if (__DEV__) {
    console.error(`[${context || "Error"}]:`, error);
    if (error instanceof AppError && error.originalError) {
      console.error("Original error:", error.originalError);
    }
  }
  // TODO: Send to error tracking service (Sentry, etc.) in production
}

/**
 * Validate that a value is not null/undefined
 */
export function assertExists<T>(
  value: T | null | undefined,
  message: string = "Value does not exist",
): asserts value is T {
  if (value === null || value === undefined) {
    throw new AppError(ErrorType.VALIDATION, message);
  }
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    logError(
      new AppError(ErrorType.STORAGE, "Failed to parse JSON", error as Error),
      "safeJsonParse",
    );
    return fallback;
  }
}
