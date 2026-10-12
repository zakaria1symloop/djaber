// 06-api "Notifications, home, analytics" — `GET /dashboard/home` (ANA-01), permission `analytics.read` (every member).
import { Controller, Get, Req } from '@nestjs/common';
import { RequirePermission } from '../../core/auth/decorators';
import { HomeService } from './home.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly home: HomeService) {}

  @Get('home')
  @RequirePermission('analytics.read')
  get(@Req() req: any) {
    return this.home.home(req.locale ?? 'fr');
  }
}
