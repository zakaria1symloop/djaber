// Reference data for address forms (69 wilayas, communes). Public and cacheable. See assumptions-log (M0).
import { Controller, Get, Header, Param, ParseIntPipe } from '@nestjs/common';
import { prisma } from '@djaber/db';
import { Public } from '../../core/auth/decorators';

@Controller('geo')
export class GeoController {
  @Public()
  @Get('wilayas')
  @Header('Cache-Control', 'public, max-age=86400')
  wilayas() {
    return prisma.wilaya.findMany({ orderBy: { id: 'asc' }, select: { id: true, code: true, nameFr: true, nameAr: true } });
  }

  @Public()
  @Get('wilayas/:id/communes')
  @Header('Cache-Control', 'public, max-age=86400')
  communes(@Param('id', ParseIntPipe) id: number) {
    return prisma.commune.findMany({
      where: { wilayaId: id },
      orderBy: { nameFr: 'asc' },
      select: { id: true, wilayaId: true, nameFr: true, nameAr: true, postalCode: true },
    });
  }
}
