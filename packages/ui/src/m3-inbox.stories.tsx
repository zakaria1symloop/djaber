// M3 inbox kit — Figma "INB — Inbox — thread with handoff", "INB — Inbox — AR (RTL)",
// "DLG — Inbox & queue — popovers, message types, banners, composer states".
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import {
  AiBadge,
  AssigneeChip,
  AudioPlayer,
  BubbleText,
  Button,
  Composer,
  ConversationItem,
  DaySeparator,
  DeliveryFailure,
  DeliveryMark,
  FileAttachment,
  HandoffNote,
  ImageAttachment,
  InternalNote,
  LocationAttachment,
  MessageBubble,
  MonoTag,
  OrderCard,
  Pill,
  PostbackBubble,
  ProductCards,
  StickerAttachment,
  StoryContext,
  SystemEvent,
  ThreadBanner,
  ThreePane,
  TypingChip,
  UnreadBadge,
  VideoAttachment,
  type ComposerReply,
  type DeliveryLabels,
} from './index';

const meta: Meta = { title: 'M3/Inbox kit' };
export default meta;
type Story = StoryObj;

const Frame = ({ children, wide }: { children: React.ReactNode; wide?: boolean }) => <div className={`mx-auto flex flex-col gap-4 p-6 ${wide ? 'max-w-5xl' : 'max-w-xl'}`}>{children}</div>;
const PIXEL = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="100%" height="100%" fill="#1c1c1c"/></svg>');
const LABELS: DeliveryLabels = { pending: 'Envoi…', sent: 'Envoyé', failed: 'Non délivré', skipped_window: 'Non délivré — hors fenêtre 24 h', retry: 'Réessayer' };
const REPLIES: ComposerReply[] = [
  { id: '1', title: 'Livraison Sétif', preview: 'Livraison 500 DA à domicile, 350 DA stop-desk…', shortcut: '/livr' },
  { id: '2', title: 'Merci pour votre commande', preview: 'Merci {prénom} ! Nous vous appelons pour confirmer…', shortcut: '/merci' },
  { id: '3', title: 'Horaires', preview: 'Nous sommes disponibles de 9h à 20h…', shortcut: '/horaires' },
];

const Rows = () => (
  <>
    <ConversationItem
      name="Amina B."
      time="2 MIN"
      preview="راني حابة نبدل القياس، حابتي صغيرة"
      unread={1}
      unreadLabel="1 message non lu"
      active
      tags={
        <>
          <MonoTag tone="warning">À TRAITER</MonoTag>
          <MonoTag>IA EN PAUSE</MonoTag>
        </>
      }
    />
    <ConversationItem name="Sara K." time="26 MIN" preview="La Robe satin — Noir — M est à 4 900 DA" outbound meta={<AssigneeChip name="Nadia F." label="Assignée à Nadia F." />} />
    <ConversationItem name="Rym A." time="LUN." preview="Merci beaucoup !" tags={<MonoTag>TERMINÉ</MonoTag>} />
    <ConversationItem name="Walid H." time="SAM." preview="Avec plaisir, à bientôt !" outbound tags={<MonoTag>ARCHIVÉ</MonoTag>} />
    <ConversationItem name="Fake Buyer" time="3 H" preview="…" tags={<MonoTag tone="danger">BLOQUÉ</MonoTag>} />
  </>
);

export const ConversationRows: Story = {
  render: () => (
    <Frame>
      <div className="rounded-card border border-line-edge">
        <Rows />
      </div>
      <div className="flex items-center gap-3">
        <UnreadBadge count={3} label="3 messages non lus" />
        <UnreadBadge count={120} label="120 messages non lus" />
        <AiBadge>IA</AiBadge>
        <AssigneeChip name="Sara Kaci" label="Assignée à Sara Kaci" />
        <TypingChip label="Vendeur Pro rédige…" />
      </div>
    </Frame>
  ),
};

export const MessageTypes: Story = {
  render: () => (
    <Frame>
      <DaySeparator>Aujourd’hui</DaySeparator>
      <MessageBubble author="customer" meta="10:41 · CLIENT">
        <BubbleText>سلام، الروب ساتان كاين؟</BubbleText>
      </MessageBubble>
      <MessageBubble
        author="ai"
        meta={
          <>
            10:41 · VENDEUR PRO · IA <DeliveryMark status="sent" labels={LABELS} />
          </>
        }
      >
        <BubbleText>أهلاً أمينة، نعم الروب ساتان متوفرة بالأسود والأحمر. أي قياس تحبي؟</BubbleText>
      </MessageBubble>
      <MessageBubble author="ai" bare grouped meta="10:41 · VENDEUR PRO · IA">
        <ProductCards
          label="Fiches produit envoyées"
          cards={[
            { id: '1', name: 'La Robe satin', price: '4 900 DA', variants: 'S · M · L' },
            { id: '2', name: 'Tunique brodée', price: '2 200 DA' },
          ]}
        />
      </MessageBubble>
      <MessageBubble author="customer" bare meta="10:42 · CLIENT">
        <ImageAttachment src={PIXEL} alt="Image" openLabel="Afficher l’image en plein écran" />
      </MessageBubble>
      <MessageBubble author="customer" meta="10:42 · CLIENT">
        <AudioPlayer src="" duration="0:40" playLabel="Écouter le vocal" pauseLabel="Mettre en pause">
          Transcription : « est-ce que la robe existe en rouge »
        </AudioPlayer>
      </MessageBubble>
      <MessageBubble author="customer" meta="10:42 · CLIENT">
        <AudioPlayer src="" duration="2:31" playLabel="Écouter le vocal" pauseLabel="Mettre en pause">
          Vocal de plus de 2 min : non transcrit
        </AudioPlayer>
      </MessageBubble>
      <MessageBubble author="customer" bare meta="10:42 · CLIENT">
        <VideoAttachment src="" label="Vidéo" />
      </MessageBubble>
      <MessageBubble author="customer" meta="10:42 · CLIENT">
        <FileAttachment href="#" name="facture.pdf" size="240 Ko" downloadLabel="Télécharger" />
      </MessageBubble>
      <MessageBubble author="customer" meta="10:42 · CLIENT">
        <LocationAttachment href="#" label="Position · El Eulma" openLabel="OUVRIR LA CARTE" />
      </MessageBubble>
      <MessageBubble author="customer" bare meta="10:42 · CLIENT">
        <StickerAttachment src={PIXEL} alt="Sticker" />
      </MessageBubble>
      <MessageBubble author="customer" meta="10:42 · CLIENT">
        <PostbackBubble label="Postback :" value="Voir le catalogue" />
      </MessageBubble>
      <MessageBubble author="customer" meta="10:43 · CLIENT">
        <StoryContext label="A répondu à votre story" thumbnailUrl={PIXEL} />
        <BubbleText>C’est combien ?</BubbleText>
      </MessageBubble>
      <MessageBubble author="customer" flagged meta="10:43 · CLIENT">
        <BubbleText>Message contenant un mot bloqué</BubbleText>
      </MessageBubble>
    </Frame>
  ),
};

export const AuthorsSystemAndFailures: Story = {
  render: () => (
    <Frame>
      <MessageBubble author="human" meta="NADIA F. · 10:42">
        <BubbleText>Bonjour, c’est Nadia. Votre colis part demain.</BubbleText>
      </MessageBubble>
      <MessageBubble author="human" pending meta="NADIA F. · 10:43" footer={<button className="ts-label-meta text-accent-inbound">Annuler</button>}>
        <BubbleText>Envoi en cours (annulable 2 s)</BubbleText>
      </MessageBubble>
      <div className="flex justify-center">
        <HandoffNote>TRANSMIS À UN HUMAIN · RÈGLE « REMBOURSEMENT » · 10:52</HandoffNote>
      </div>
      <SystemEvent>Commande #CMD-1042 créée par l’IA · 10:58</SystemEvent>
      <SystemEvent>IA mise en pause par Nadia F. · 11:02</SystemEvent>
      <SystemEvent>IA reprise · 11:40</SystemEvent>
      <SystemEvent>Conversation résolue par Zakaria A.</SystemEvent>
      <SystemEvent tone="warning">Message IA non envoyé : hors fenêtre 24 h (skipped_window)</SystemEvent>
      <MessageBubble
        author="human"
        meta={
          <span className="text-accent-alert">
            NADIA F. · 10:42 <DeliveryMark status="failed" labels={LABELS} />
          </span>
        }
        footer={
          <DeliveryFailure retryLabel="Réessayer" onRetry={() => {}}>
            Non délivré — hors fenêtre 24 h
          </DeliveryFailure>
        }
      >
        <BubbleText>Votre commande est confirmée ✓</BubbleText>
      </MessageBubble>
      <MessageBubble author="ai" meta="10:44 · VENDEUR PRO · IA" footer={<DeliveryFailure>Non délivré — hors fenêtre 24 h</DeliveryFailure>}>
        <BubbleText>Votre colis est en route.</BubbleText>
      </MessageBubble>
      <InternalNote author="SARA K." time="2 OCT.">
        Cliente fidèle, préfère le stop-desk El Eulma.
      </InternalNote>
      <OrderCard number="#CMD-1042" total="4 900 DA" status={<Pill tone="success">LIVRÉE</Pill>} />
    </Frame>
  ),
};

export const Banners: Story = {
  render: () => (
    <Frame>
      <ThreadBanner kind="aiPaused" title="IA mise en pause par Nadia F." description="L’agent ne répond plus sur ce fil tant que vous ne le reprenez pas." actions={<Button>Reprendre l’IA</Button>} />
      <ThreadBanner kind="needsHuman" title="L’agent a transmis la conversation : règle « demande de remboursement »" description="L’IA est en pause. Répondez ou reprenez l’IA." actions={<Button>Reprendre l’IA</Button>} />
      <ThreadBanner kind="reconnect" tone="danger" title="Reconnexion requise — « Amel Outlet »" description="Jeton Meta expiré (PAGE_TOKEN_EXPIRED)." />
      <ThreadBanner kind="credits" tone="danger" title="IA arrêtée : crédits épuisés" description="Répondez manuellement ou renouvelez vos crédits." />
      <ThreadBanner kind="pausedByPlan" title="Page en pause (plan)" description="CHANNEL_PAUSED_BY_PLAN" />
      <ThreadBanner kind="aiUnavailable" tone="danger" title="IA indisponible" description="AI_PROVIDER_ERROR : la conversation passe en file d’attente." />
      <ThreadBanner kind="blocked" tone="neutral" title="Client bloqué le 04 oct. par Nadia" description="Ses messages restent enregistrés, sans notification." actions={<Button>Débloquer</Button>} />
      <ThreadBanner kind="outsideWindow" title="HORS FENÊTRE 24 H" description="Seul un message modèle est possible (Messenger)." />
    </Frame>
  ),
};

function ComposerDemo({ initial = '', tooLong, attachment, error }: { initial?: string; tooLong?: boolean; attachment?: 'ok' | 'error'; error?: string }) {
  const [value, setValue] = useState(initial);
  const slash = /^\/\S*$/.test(value) ? { heading: 'RÉPONSES RAPIDES', emptyLabel: 'Aucune réponse rapide ne correspond', items: REPLIES.filter((r) => r.shortcut!.startsWith(value)) } : null;
  return (
    <Composer
      value={value}
      onChange={setValue}
      onSend={() => setValue('')}
      placeholder="Écrire une réponse… (Entrée pour envoyer)"
      label="Votre réponse"
      sendLabel="Envoyer"
      canSend={value.trim().length > 0 && !tooLong}
      counter={tooLong ? '2 010 / 2 000' : undefined}
      tooLong={tooLong}
      error={tooLong ? '2000 caractères max. (REPLY_TOO_LONG)' : error}
      attachLabel="Joindre une image"
      onAttach={() => {}}
      attachment={attachment ? { previewUrl: PIXEL, name: 'robe.jpg', error: attachment === 'error' ? 'Image trop lourde (5 Mo max). (IMAGE_TOO_LARGE)' : undefined, removeLabel: 'Retirer l’image', onRemove: () => {} } : null}
      chips={value ? undefined : REPLIES.map((r) => ({ id: r.id, label: r.title }))}
      slash={slash}
      onPickReply={(id) => setValue(REPLIES.find((r) => r.id === id)?.preview ?? '')}
      footnote="Répondre mettra l’IA en pause pour cette conversation (modifiable dans Paramètres)."
    />
  );
}

export const ComposerStates: Story = {
  render: () => (
    <Frame>
      <ComposerDemo />
      <div className="pt-40">
        <ComposerDemo initial="/" />
      </div>
      <ComposerDemo initial="Bonjour" attachment="ok" />
      <ComposerDemo initial="" attachment="error" />
      <ComposerDemo initial="Texte trop long…" tooLong />
      <ComposerDemo initial="Bonjour" error="Hors fenêtre de 24 h : le client doit écrire d’abord. (REPLY_OUTSIDE_WINDOW)" />
      <Composer value="" onChange={() => {}} onSend={() => {}} placeholder="" label="Votre réponse" sendLabel="Envoyer" canSend={false} disabled={{ tag: 'HORS FENÊTRE 24 H', reason: 'Hors fenêtre de 24 h : le client doit écrire d’abord. (REPLY_OUTSIDE_WINDOW)', action: <Button size="sm">Envoyer un message modèle</Button> }} />
      <Composer value="" onChange={() => {}} onSend={() => {}} placeholder="" label="Votre réponse" sendLabel="Envoyer" canSend={false} disabled={{ tone: 'danger', tag: 'CANAL INACTIF', reason: 'Page en pause ou déconnectée. (REPLY_CHANNEL_INACTIVE)', action: <Button size="sm">Reconnecter</Button> }} />
      <Composer value="" onChange={() => {}} onSend={() => {}} placeholder="" label="Votre réponse" sendLabel="Envoyer" canSend={false} disabled={{ tone: 'neutral', tag: 'BLOQUÉ', reason: 'Client bloqué : aucun envoi tant qu’il n’est pas débloqué par un admin.' }} />
    </Frame>
  ),
};

export const ThreePaneLayout: Story = {
  render: () => (
    <div className="h-[640px] border border-line-edge">
      <ThreePane
        view="thread"
        panelLabel="Client & notes"
        list={
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Rows />
          </div>
        }
        thread={
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5">
              <MessageBubble author="customer" meta="10:41 · CLIENT">
                <BubbleText>سلام، الروب ساتان كاين؟</BubbleText>
              </MessageBubble>
              <MessageBubble author="human" meta="NADIA F. · 10:42">
                <BubbleText>Bonjour, oui elle est disponible.</BubbleText>
              </MessageBubble>
            </div>
            <ComposerDemo />
          </div>
        }
        panel={
          <div className="p-5">
            <InternalNote author="SARA K." time="2 OCT.">
              Cliente fidèle, préfère le stop-desk El Eulma.
            </InternalNote>
          </div>
        }
      />
    </div>
  ),
};
