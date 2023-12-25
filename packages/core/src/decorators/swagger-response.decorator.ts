import { ApiResponseOptions } from '@nestjs/swagger'

class HttpExceptionResponse {
  /**
   * Status Code
   * @example 500
   */
  status: number
  /**
   * Error message
   * @example "Internal Server Error"
   */
  message: string
}

export function SwaggerResponse(
  ApiResponse: (
    options?: ApiResponseOptions,
  ) => MethodDecorator & ClassDecorator,
  options: ApiResponseOptions = {},
) {
  return ApiResponse({ type: HttpExceptionResponse, ...options })
}
