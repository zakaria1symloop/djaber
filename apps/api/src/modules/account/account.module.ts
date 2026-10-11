import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { WorkspacesListController } from './workspaces-list.controller';

/** Account-level endpoints that need no workspace (`/me/*`, `GET /workspaces`). Auth itself lives in modules/auth (M1). */
@Module({ controllers: [DevicesController, WorkspacesListController] })
export class AccountModule {}
