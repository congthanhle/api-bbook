// src/common/exceptions/insufficient-stock.exception.ts

import { ConflictException } from '@nestjs/common';

/**
 * Thrown when a product does not have enough stock for the requested quantity.
 */
export class InsufficientStockException extends ConflictException {
  constructor(productName: string, available: number, requested: number) {
    super({
      code: 'INSUFFICIENT_STOCK',
      message: `Insufficient stock for "${productName}": available ${available}, requested ${requested}`,
      details: { productName, available, requested },
    });
  }
}
