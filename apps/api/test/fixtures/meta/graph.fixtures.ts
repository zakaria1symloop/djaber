// Hand-written Graph API responses in the documented shapes (developers.facebook.com, Graph API v21.0), used by the
// contract tests of the Graph adapter with `fetch` stubbed. Every id and token below is made up; nothing was recorded
// from, or is ever sent to, the live Meta app.
export const TOKENS = {
  code: 'AQD-fixture-code',
  shortUser: 'EAAB-short-user-token',
  longUser: 'EAAB-long-user-token',
  page: 'EAAB-page-token-1',
  igShort: 'IGQV-short-token',
  igLong: 'IGQV-long-token',
  igRefreshed: 'IGQV-refreshed-token',
};

export const oauthShort = { access_token: TOKENS.shortUser, token_type: 'bearer', expires_in: 5183944 };
export const oauthLong = { access_token: TOKENS.longUser, token_type: 'bearer', expires_in: 5184000 };

export const accountsPage1 = {
  data: [
    { id: '104455667788990', name: 'Boutique Yasmine', access_token: TOKENS.page, tasks: ['ADVERTISE', 'ANALYZE', 'CREATE_CONTENT', 'MESSAGING', 'MODERATE', 'MANAGE'], picture: { data: { url: 'https://scontent.xx.fbcdn.net/v/p1.jpg' } } },
    { id: '104455667788991', name: 'Page sans messagerie', access_token: 'EAAB-page-token-2', tasks: ['ANALYZE'], picture: { data: { url: 'https://scontent.xx.fbcdn.net/v/p2.jpg' } } },
  ],
  paging: { cursors: { before: 'QVFI', after: 'QVFJ' }, next: 'https://graph.facebook.com/v21.0/1234567890/accounts?fields=id%2Cname%2Caccess_token%2Ctasks%2Cpicture%7Burl%7D&limit=100&after=QVFJ' },
};
export const accountsPage2 = {
  data: [{ id: '104455667788992', name: 'Page sans jeton', tasks: ['MESSAGING'] }],
  paging: { cursors: { before: 'QVFK', after: 'QVFL' } },
};

export const linkedInstagram = { instagram_business_account: { id: '17841400000000001', name: 'Boutique Yasmine', username: 'boutique.yasmine', profile_picture_url: 'https://scontent.cdninstagram.com/v/ig.jpg' }, id: '104455667788990' };
export const noLinkedInstagram = { id: '104455667788990' };

export const igOauthShort = { access_token: TOKENS.igShort, user_id: 17841400000000002, permissions: ['instagram_business_basic', 'instagram_business_manage_messages'] };
export const igOauthLong = { access_token: TOKENS.igLong, token_type: 'bearer', expires_in: 5183944 };
export const igProfile = { user_id: '17841400000000002', username: 'atelier.dz', name: 'Atelier DZ', profile_picture_url: 'https://scontent.cdninstagram.com/v/me.jpg', id: '9988776655' };
export const igRefresh = { access_token: TOKENS.igRefreshed, token_type: 'bearer', expires_in: 5184000 };

export const debugTokenValid = { data: { app_id: '100000000000001', type: 'PAGE', application: 'Djaber', expires_at: 0, is_valid: true, scopes: ['pages_messaging', 'pages_manage_metadata'], profile_id: '104455667788990' } };
export const debugTokenInvalid = { data: { app_id: '100000000000001', is_valid: false, error: { code: 190, message: 'The session has been invalidated', subcode: 460 }, scopes: [] } };

export const subscribed = { success: true };
export const sendOk = { recipient_id: '6789012345678901', message_id: 'm_AbCdEfGhIjKlMnOpQrStUvWxYz' };
export const profileFb = { first_name: 'Karim', last_name: 'Bensalem', profile_pic: 'https://platform-lookaside.fbsbx.com/platform/profilepic/?psid=6789012345678901', id: '6789012345678901' };
export const profileIg = { name: 'Sara H.', username: 'sara.h', profile_pic: 'https://scontent.cdninstagram.com/v/sara.jpg', id: '1122334455667788' };

export const conversations = {
  data: [
    {
      id: 't_10158000000000001',
      updated_time: '2026-10-10T18:22:10+0000',
      participants: { data: [{ name: 'Karim Bensalem', email: '6789012345678901@facebook.com', id: '6789012345678901' }, { name: 'Boutique Yasmine', email: '104455667788990@facebook.com', id: '104455667788990' }] },
      messages: {
        data: [
          { id: 'm_hist_2', from: { name: 'Boutique Yasmine', id: '104455667788990' }, to: { data: [{ id: '6789012345678901' }] }, message: '2 500 DA, livraison 58 wilayas', created_time: '2026-10-10T18:22:10+0000' },
          {
            id: 'm_hist_1',
            from: { name: 'Karim Bensalem', id: '6789012345678901' },
            to: { data: [{ id: '104455667788990' }] },
            message: '',
            attachments: { data: [{ id: '987', mime_type: 'image/jpeg', name: 'photo.jpg', size: 81234, image_data: { width: 720, height: 960, url: 'https://scontent.xx.fbcdn.net/v/hist.jpg', preview_url: 'https://scontent.xx.fbcdn.net/v/hist_p.jpg' } }] },
            created_time: '2026-10-10T18:20:01+0000',
          },
        ],
      },
    },
  ],
  paging: { cursors: { before: 'QVFA', after: 'QVFB' } },
};

export const pageInfo = { name: 'Boutique Yasmine', picture: { data: { url: 'https://scontent.xx.fbcdn.net/v/p1.jpg' } }, followers_count: 15230, id: '104455667788990' };
export const insights = {
  data: [
    { name: 'page_messages_total_messaging_connections', period: 'day', values: [{ value: 410, end_time: '2026-10-10T07:00:00+0000' }, { value: 418, end_time: '2026-10-11T07:00:00+0000' }], id: '104455667788990/insights/page_messages_total_messaging_connections/day' },
    { name: 'page_fans', period: 'day', values: [{ value: 15230, end_time: '2026-10-11T07:00:00+0000' }], id: '104455667788990/insights/page_fans/day' },
  ],
};

/** `{ error: { message, type, code, error_subcode, fbtrace_id } }` bodies per the error table of 05-integrations §1.4. */
export const errors = {
  token190: { error: { message: 'Error validating access token: The session has been invalidated because the user changed their password.', type: 'OAuthException', code: 190, error_subcode: 460, fbtrace_id: 'AbC' } },
  oauth102: { error: { message: 'Session key invalid or no longer valid', type: 'OAuthException', code: 102, fbtrace_id: 'AbD' } },
  outsideWindow: { error: { message: '(#10) This message is sent outside of allowed window.', type: 'OAuthException', code: 10, error_subcode: 2018278, fbtrace_id: 'AbE' } },
  noMessagingPermission: { error: { message: '(#10) Application does not have permission for this action', type: 'OAuthException', code: 10, error_subcode: 2018065, fbtrace_id: 'AbF' } },
  permission200: { error: { message: '(#200) Requires pages_messaging permission', type: 'OAuthException', code: 200, fbtrace_id: 'AbG' } },
  rateLimit613: { error: { message: '(#613) Calls to this api have exceeded the rate limit.', type: 'OAuthException', code: 613, fbtrace_id: 'AbH' } },
  rateLimit4: { error: { message: '(#4) Application request limit reached', type: 'OAuthException', code: 4, fbtrace_id: 'AbI' } },
  userUnavailable: { error: { message: '(#551) This person isn\'t available right now.', type: 'OAuthException', code: 551, error_subcode: 1545041, fbtrace_id: 'AbJ' } },
  invalidAttachment: { error: { message: '(#100) Upload attachment failure.', type: 'OAuthException', code: 100, error_subcode: 2534014, fbtrace_id: 'AbK' } },
  temporary2: { error: { message: 'An unexpected error has occurred. Please retry your request later.', type: 'OAuthException', code: 2, is_transient: true, fbtrace_id: 'AbL' } },
  unknown: { error: { message: 'Unsupported get request.', type: 'GraphMethodException', code: 100, error_subcode: 33, fbtrace_id: 'AbM' } },
};
