import { Module } from '@nestjs/common';
import { ImageUploadService } from './image-upload.service';
import { UploadsController } from './uploads.controller';

@Module({ controllers: [UploadsController], providers: [ImageUploadService], exports: [ImageUploadService] })
export class UploadsModule {}
