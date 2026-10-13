// ADM-12 + merchant HELP (D38, D46): support tickets (merchant + platform), canned replies, help articles, ticket jobs.
import { Module } from '@nestjs/common';
import { AdminSupportController, HelpController, SupportController } from './support.controllers';
import { HelpService } from './help.service';
import { SupportTicketService } from './support-ticket.service';

@Module({
  controllers: [HelpController, SupportController, AdminSupportController],
  providers: [SupportTicketService, HelpService],
  exports: [SupportTicketService, HelpService],
})
export class SupportModule {}
