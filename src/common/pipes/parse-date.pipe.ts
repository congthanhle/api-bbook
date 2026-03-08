// src/common/pipes/parse-date.pipe.ts

import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * Pipe that parses a string into a JavaScript `Date` object.
 * Throws a `BadRequestException` if the value is not a valid date string.
 *
 * @example
 * ```ts
 * @Get('by-date')
 * findByDate(@Query('date', ParseDatePipe) date: Date) { ... }
 * ```
 */
@Injectable()
export class ParseDatePipe implements PipeTransform<string, Date> {
  transform(value: string): Date {
    if (!value) {
      throw new BadRequestException('Date value is required');
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
      throw new BadRequestException(
        `Invalid date format: "${value}". Expected ISO 8601 (e.g. 2024-01-15)`,
      );
    }

    return date;
  }
}
