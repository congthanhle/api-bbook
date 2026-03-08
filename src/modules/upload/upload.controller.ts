// src/modules/upload/upload.controller.ts

import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiCreatedResponse } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { UploadService } from './upload.service';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_ASSET_SIZE = 5 * 1024 * 1024; // 5MB

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  // ── AVATARS ─────────────────────────────────────────────

  @Post('avatar')
  @Roles('admin', 'staff')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload avatar image (Max 2MB)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ description: 'Public URL of the uploaded image' })
  async uploadAvatar(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ })
        .addMaxSizeValidator({ maxSize: MAX_AVATAR_SIZE })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    const path = this.uploadService.generatePath(userId, file.originalname);
    const url = await this.uploadService.uploadFile(file, 'avatars', path);
    return { url };
  }

  // ── COURTS ──────────────────────────────────────────────

  @Post('court')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload court image (Admin only, Max 5MB)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ description: 'Public URL of the uploaded image' })
  async uploadCourtImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ })
        .addMaxSizeValidator({ maxSize: MAX_ASSET_SIZE })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
    @CurrentUser('id') adminId: string,
  ) {
    const path = this.uploadService.generatePath(adminId, file.originalname);
    const url = await this.uploadService.uploadFile(file, 'courts', path);
    return { url };
  }

  // ── PRODUCTS ────────────────────────────────────────────

  @Post('product')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload product image (Admin only, Max 5MB)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ description: 'Public URL of the uploaded image' })
  async uploadProductImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ })
        .addMaxSizeValidator({ maxSize: MAX_ASSET_SIZE })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
    @CurrentUser('id') adminId: string,
  ) {
    const path = this.uploadService.generatePath(adminId, file.originalname);
    const url = await this.uploadService.uploadFile(file, 'products', path);
    return { url };
  }
}
