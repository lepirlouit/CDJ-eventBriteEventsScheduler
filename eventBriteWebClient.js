/**
 * Client for Eventbrite's *private* web API (https://www.eventbrite.be/api/v3/missive/...).
 *
 * The public API (www.eventbriteapi.com/v3, Bearer EVENTBRITE_Private_token) has no
 * `missive` surface at all, so email campaigns can only be driven through the endpoints
 * the organizer web UI itself calls. Those use cookie-session auth: the OAuth token does
 * NOT work here. See README for how to copy the cookie out of DevTools.
 *
 * This is a reverse-engineered, undocumented API. It can change without notice.
 * Everything implemented below was observed in a real browser session.
 */

const BASE_URL = 'https://www.eventbrite.be/api/v3';
const ORIGIN = 'https://www.eventbrite.be';
const CAMPAIGNS_UI_URL = 'https://www.eventbrite.be/organizations/campaigns/email';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:152.0) Gecko/20100101 Firefox/152.0';

/**
 * The web UI sends a Referer scoped to the campaign being edited. Mirror it.
 * @param {string} campaignId
 * @returns {string}
 */
const campaignRefererUrl = (campaignId) => `${CAMPAIGNS_UI_URL}/${campaignId}`;

const COOKIE_HELP = `
The private campaign API (${BASE_URL}/missive/...) accepts cookie-session auth only;
the EVENTBRITE_Private_token OAuth token does NOT work on these paths.
To get the cookie:
  1. Log in to https://www.eventbrite.be and open the Email campaigns page.
  2. DevTools > Network, click any request to www.eventbrite.be/api/v3/...
  3. Request Headers > Cookie > right-click > Copy value.
     (Do NOT use document.cookie in the console: the \`session\` cookie is HttpOnly
      and would be missing.)
  4. Put it in .env on ONE line, single-quoted (the value contains " { } %):
     EVENTBRITE_WEB_COOKIE='csrftoken=...; session=...; ...'
This is a full session credential - it grants everything your logged-in user can do.
Never commit it.`;

/**
 * Reads and validates the web-session credentials from the environment.
 *
 * The X-CSRFToken header must match the `csrftoken` cookie exactly or every POST 403s,
 * so it is derived from the cookie rather than configured separately: a stale standalone
 * token would fail identically to an expired session, which is a miserable thing to debug.
 * EVENTBRITE_WEB_CSRF_TOKEN stays available as an override.
 *
 * @returns {{cookie: string, csrfToken: string}}
 */
const readCredentials = () => {
  // DevTools "Copy value" can wrap long cookies across lines
  const cookie = (process.env.EVENTBRITE_WEB_COOKIE || '').trim().replace(/\s*[\r\n]+\s*/g, ' ');
  if (!cookie) {
    throw new Error(`EVENTBRITE_WEB_COOKIE is not set.${COOKIE_HELP}`);
  }

  const csrfTokenFromCookie = /(?:^|;\s*)csrftoken=([^;\s]+)/.exec(cookie)?.[1];
  const csrfToken = (process.env.EVENTBRITE_WEB_CSRF_TOKEN || '').trim() || csrfTokenFromCookie;
  if (!csrfToken) {
    throw new Error(
      `EVENTBRITE_WEB_COOKIE has no \`csrftoken\` entry, so the CSRF token cannot be derived.
You probably copied a partial cookie, or copied document.cookie (which omits HttpOnly entries).
Re-copy the whole Cookie request header, or set EVENTBRITE_WEB_CSRF_TOKEN explicitly.${COOKIE_HELP}`
    );
  }

  return { cookie, csrfToken };
}

/**
 * @param {{method?: string, path: string, body?: object, referer?: string}}
 * @returns {Promise<any>} the parsed JSON response
 */
const request = async ({ method = 'GET', path, body, referer = CAMPAIGNS_UI_URL }) => {
  const { cookie, csrfToken } = readCredentials();

  const headers = {
    'Accept': '*/*',
    'Accept-Language': 'fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cookie': cookie,
    'Referer': referer,
    'User-Agent': BROWSER_USER_AGENT,
    'X-CSRFToken': csrfToken,
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
    headers['Origin'] = ORIGIN;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Read as text first: an expired session redirects to the signin page, and fetch follows
  // redirects, so a dead cookie can arrive as 200 + HTML. Calling response.json() straight
  // away would surface that as `SyntaxError: Unexpected token '<'`.
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (response.status === 401 || response.status === 403 || contentType.includes('text/html')) {
    throw new Error(
      `Eventbrite web session rejected (${response.status} on ${method} ${path}, content-type ${contentType || 'none'}).
Your EVENTBRITE_WEB_COOKIE has most likely expired - re-copy the Cookie header from DevTools
and update .env. If you set EVENTBRITE_WEB_CSRF_TOKEN by hand, unset it so the token is
derived from the cookie instead.`
    );
  }

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Unexpected non-JSON response (${response.status}) from ${method} ${path}: ${text.slice(0, 200)}`);
  }

  if (response.ok) {
    return data;
  }

  throw new Error(`${method} ${path} failed (${response.status}): ${data?.error} - ${data?.error_description}`);
}

/**
 * Maps a theme as returned by GET /missive/themes/{id}/ onto the flat shape the
 * save and preview payloads expect (nested {url, id} objects become plain *_id fields).
 * @param {object} theme
 * @returns {object}
 */
const toThemePayload = (theme) => ({
  primary_color: theme.primary_color,
  background_color: theme.background_color,
  header_image_id: theme.header_image?.id ?? null,
  header_image_link: theme.header_image_link,
  header_image_alt_text: theme.header_image_alt_text,
  theme_type: theme.theme_type,
  background_image_id: theme.background_image?.id ?? null,
});

/**
 * Same mapping for the missive organization metadata: `logo: {url, id}` becomes `logo_id`.
 * @param {object} organizationMetadata
 * @returns {object}
 */
const toOrganizationMetadataPayload = (organizationMetadata) => ({
  name: organizationMetadata.name,
  events_url: organizationMetadata.events_url,
  facebook_url: organizationMetadata.facebook_url,
  instagram_url: organizationMetadata.instagram_url,
  twitter_url: organizationMetadata.twitter_url,
  logo_id: organizationMetadata.logo?.id ?? null,
});

/**
 * The address is returned with an `id` but must be sent without one, so the six fields
 * are picked explicitly rather than spread.
 * @param {object} organizationMetadata
 * @returns {object}
 */
const toOrganizationAddressPayload = ({ organization_address: address }) => ({
  address_1: address.address_1,
  address_2: address.address_2,
  city: address.city,
  region: address.region,
  postal_code: address.postal_code,
  country: address.country,
});

/**
 * @param {{organizationId: string}}
 * @returns {Promise<object>} settings, incl. `locale` and `daily_send_limit`
 */
module.exports.getMissiveSettings = async ({ organizationId }) =>
  request({ path: `/missive/organization/${organizationId}/settings/` });

/**
 * @param {{organizationId: string, page?: number, pageSize?: number, sortBy?: string}}
 * @returns {Promise<object[]>}
 */
module.exports.listCampaigns = async ({ organizationId, page = 1, pageSize = 10, sortBy = 'created_desc' }) => {
  const queryString = new URLSearchParams({ page, page_size: pageSize, sort_by: sortBy }).toString();
  const data = await request({ path: `/organizations/${organizationId}/missive/campaigns/?${queryString}` });
  return data.campaigns;
}

/**
 * Duplicates a campaign. The copy is created as a draft named "<original> (copy N)".
 * It keeps the original's contact lists but NOT its event association.
 * @param {{campaignId: string, locale: string}}
 * @returns {Promise<object>} the new campaign
 */
module.exports.duplicateCampaign = async ({ campaignId, locale }) =>
  request({
    method: 'POST',
    path: `/missive/campaigns/${campaignId}/duplicate/`,
    body: { locale },
    referer: CAMPAIGNS_UI_URL,
  });

/**
 * @param {{campaignId: string}}
 * @returns {Promise<object>}
 */
module.exports.getCampaign = async ({ campaignId }) =>
  request({ path: `/missive/campaigns/${campaignId}/`, referer: campaignRefererUrl(campaignId) });

/**
 * @param {{themeId: string}}
 * @returns {Promise<object>}
 */
module.exports.getTheme = async ({ themeId }) =>
  request({ path: `/missive/themes/${themeId}/` });

/**
 * Note this is keyed by the campaign's `organization_metadata_id`, NOT by the
 * organization id - they are different numbers on adjacent endpoints.
 * @param {{organizationMetadataId: string}}
 * @returns {Promise<object>}
 */
module.exports.getMissiveOrganizationMetadata = async ({ organizationMetadataId }) =>
  request({ path: `/missive/organization/${organizationMetadataId}/` });

/**
 * @param {{campaignId: string}}
 * @returns {Promise<object[]>}
 */
module.exports.listCampaignEvents = async ({ campaignId }) => {
  const data = await request({
    path: `/missive/campaigns/${campaignId}/events/`,
    referer: campaignRefererUrl(campaignId),
  });
  return data.events;
}

/**
 * @param {{campaignId: string}}
 * @returns {Promise<object[]>}
 */
module.exports.listCampaignContactLists = async ({ campaignId }) => {
  const data = await request({
    path: `/missive/campaigns/${campaignId}/contact_lists/`,
    referer: campaignRefererUrl(campaignId),
  });
  return data.contact_lists;
}

/**
 * @param {{organizationId: string, q?: string, pageSize?: number}} pass `q` to search by
 * name rather than paging through every list on the organization
 * @returns {Promise<object[]>}
 */
module.exports.listOrganizationContactLists = async ({ organizationId, q, pageSize = 50 }) => {
  const queryString = new URLSearchParams({ page_size: pageSize, ...(q ? { q } : {}) }).toString();
  const data = await request({ path: `/organizations/${organizationId}/missive/contact_lists/?${queryString}` });
  return data.contact_lists;
}

/**
 * Lists an organization's events with filters that actually work.
 *
 * The public API's /v3/organizations/{id}/events/ ignores `status`, `time_filter`,
 * `order_by` and `page_size` outright - it always returns every event, oldest first -
 * so event selection has to go through the web API too. These params are the ones the
 * organizer UI sends.
 *
 * @param {{organizationId: string, status: string, timeFilter: string, orderBy?: string, pageSize?: number}}
 * @returns {Promise<object[]>}
 */
module.exports.listOrganizationEvents = async ({ organizationId, status, timeFilter, orderBy = 'start_asc', pageSize = 50 }) => {
  const queryString = new URLSearchParams({
    expand: 'venue,logo',
    order_by: orderBy,
    name_filter: '',
    page: 1,
    page_size: pageSize,
    series_filter: 'allevents',
    status,
    time_filter: timeFilter,
  }).toString();
  const data = await request({ path: `/organizations/${organizationId}/events/?${queryString}` });
  return data.events;
}

/**
 * @param {{contactListId: string}}
 * @returns {Promise<object>}
 */
module.exports.getContactList = async ({ contactListId }) =>
  request({ path: `/missive/contact_lists/${contactListId}/` });

/**
 * Queues an import of every attendee of the given events into a contact list.
 * Asynchronous: poll getContactImportStatus with the returned task id.
 * @param {{contactListId: string, eventIds: string[], campaignId?: string}}
 * @returns {Promise<string>} the task id
 */
module.exports.importContactsFromEvents = async ({ contactListId, eventIds, campaignId }) => {
  const data = await request({
    method: 'POST',
    path: `/missive/contact_lists/${contactListId}/contacts/import/`,
    body: { event_ids: eventIds },
    referer: campaignId ? campaignRefererUrl(campaignId) : CAMPAIGNS_UI_URL,
  });
  return data.task_id;
}

/**
 * @param {{contactListId: string, taskId: string, campaignId?: string}}
 * @returns {Promise<{status: string, stats: object}>} status is "queued" then "success"
 */
module.exports.getContactImportStatus = async ({ contactListId, taskId, campaignId }) =>
  request({
    path: `/missive/contact_lists/${contactListId}/contacts/import/${taskId}/?import_method=event`,
    referer: campaignId ? campaignRefererUrl(campaignId) : CAMPAIGNS_UI_URL,
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Imports the attendees of the given events into a contact list and waits for the
 * background task to finish.
 * @param {{contactListId: string, eventIds: string[], campaignId?: string, timeoutMs?: number, intervalMs?: number}}
 * @returns {Promise<{failed: number, total: number, processed: number, created: number}>}
 */
module.exports.importContactsFromEventsAndWait = async ({ contactListId, eventIds, campaignId, timeoutMs = 60000, intervalMs = 2000 }) => {
  const taskId = await module.exports.importContactsFromEvents({ contactListId, eventIds, campaignId });
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { status, stats } = await module.exports.getContactImportStatus({ contactListId, taskId, campaignId });
    if (status === 'success') {
      return stats;
    }
    if (status !== 'queued' && status !== 'processing') {
      throw new Error(`Contact import ${taskId} ended with status "${status}" (${JSON.stringify(stats)})`);
    }
    await sleep(intervalMs);
  }

  throw new Error(`Contact import ${taskId} did not finish within ${timeoutMs}ms - check the list in the Eventbrite UI`);
}

/**
 * Renders the campaign as the recipient would see it, WITHOUT saving anything.
 * The returned HTML does not have the subject substituted - its <title> reads
 * "VARS: subject (REPLACE W SUBJECT)". That is expected.
 * Pass eventIds to include the event card the recipient will see - the preview takes the
 * same {id, featured} shape as the save, and leaving it out renders a mail with no card.
 * @param {{campaignId: string, theme: object, organizationMetadata: object, bodyMessage: string, eventIds?: string[], locale: string}}
 * @returns {Promise<string>} the full email HTML
 */
module.exports.previewCampaign = async ({ campaignId, theme, organizationMetadata, bodyMessage, eventIds = [], locale }) => {
  const data = await request({
    method: 'POST',
    path: `/missive/campaigns/${campaignId}/preview/`,
    body: {
      theme: toThemePayload(theme),
      organization_metadata: toOrganizationMetadataPayload(organizationMetadata),
      organization_address: toOrganizationAddressPayload(organizationMetadata),
      body_message: bodyMessage,
      events: eventIds.map((eventId) => ({ id: eventId, featured: true })),
      locale,
    },
    referer: campaignRefererUrl(campaignId),
  });
  return data.preview;
}

/**
 * Saves a campaign, leaving it a draft.
 *
 * This is a FULL REPLACE of the editor state, not a partial update: whatever is omitted
 * from the payload is what the campaign ends up with. That is why the theme, organization
 * metadata and contact list ids are all required - pass them straight through from the
 * corresponding getters so nothing gets silently cleared.
 *
 * DELIBERATELY CANNOT SEND. This same endpoint is also the scheduler: adding
 * `campaign.timezone` + `campaign.time_to_send` (a UTC "...Z" string) is the entire
 * difference between a saved draft and a campaign queued for delivery. Those two fields
 * are never emitted here, so this function cannot mail anybody. Sending stays a human
 * action in the Eventbrite UI - please keep it that way.
 *
 * @param {{campaignId: string, campaign: {name: string, subject: string, from_name: string, reply_to: string, body_message: string}, theme: object, organizationMetadata: object, contactListIds: string[], eventIds?: string[], locale: string}}
 * @returns {Promise<object>} the updated campaign
 */
module.exports.saveCampaign = async ({ campaignId, campaign, theme, organizationMetadata, contactListIds, eventIds = [], locale }) => {
  // Saving a campaign that is not a draft is a trap: a save that omits `time_to_send`
  // does NOT clear an existing schedule, it just kicks the campaign into status 60
  // ("evaluating" / "review"), after which the API refuses to update OR delete it and the
  // scheduled send is still pending. Cancel with unscheduleCampaign first.
  const current = await module.exports.getCampaign({ campaignId });
  if (current.status !== 'draft') {
    throw new Error(`Refusing to save campaign ${campaignId}: its status is "${current.status}", not "draft". Cancel the scheduled send with unscheduleCampaign first.`);
  }

  return request({
    method: 'POST',
    path: `/missive/campaigns/${campaignId}/`,
    body: {
      campaign: {
        name: campaign.name,
        subject: campaign.subject,
        reply_to: campaign.reply_to,
        from_name: campaign.from_name,
        body_message: campaign.body_message,
      },
      theme: toThemePayload(theme),
      contact_lists: contactListIds,
      organization_address: toOrganizationAddressPayload(organizationMetadata),
      organization_metadata: toOrganizationMetadataPayload(organizationMetadata),
      // the API rejects bare ids here - each event must be {id, featured}
      events: eventIds.map((eventId) => ({ id: eventId, featured: true })),
      locale,
    },
    referer: campaignRefererUrl(campaignId),
  });
}

/**
 * Queues a campaign for delivery. THIS MAILS REAL PEOPLE AND CANNOT BE UNDONE.
 *
 * There is no dedicated send endpoint: delivery is the same POST as the save, plus
 * `campaign.timezone` and `campaign.time_to_send`. saveCampaign deliberately refuses to
 * emit those two fields, so this is the only function that can start a send - keep the
 * call sites few and obvious.
 *
 * Pass timeToSend as a UTC ISO string ("2026-08-29T20:00:00Z"); omit it to go out about a
 * minute from now. Note the response returns time_to_send as an object
 * ({utc, local, timezone}) even though the request takes a plain string.
 *
 * The campaign must still be a draft: saving a non-draft campaign pushes it to status 60
 * ("evaluating" / "review"), after which the API refuses to update or delete it, so the
 * guard below is not optional.
 *
 * @param {{campaignId: string, timeToSend?: string, timezone?: string}}
 * @returns {Promise<object>} the queued campaign
 */
module.exports.sendCampaign = async ({ campaignId, timeToSend, timezone = 'Europe/Brussels' }) => {
  const campaign = await module.exports.getCampaign({ campaignId });
  if (campaign.status !== 'draft') {
    throw new Error(`Refusing to send campaign ${campaignId}: its status is "${campaign.status}", not "draft".`);
  }

  const contactLists = await module.exports.listCampaignContactLists({ campaignId });
  if (contactLists.length === 0) {
    throw new Error(`Refusing to send campaign ${campaignId}: it has no contact list, so it would reach nobody.`);
  }

  const [theme, organizationMetadata] = await Promise.all([
    module.exports.getTheme({ themeId: campaign.theme_id }),
    module.exports.getMissiveOrganizationMetadata({ organizationMetadataId: campaign.organization_metadata_id }),
  ]);
  const events = await module.exports.listCampaignEvents({ campaignId });
  const { locale } = await module.exports.getMissiveSettings({ organizationId: campaign.organization_id });

  // a minute of lead time, seconds trimmed to match what the web UI sends
  const sendAt = timeToSend
    || new Date(Date.now() + 60 * 1000).toISOString().replace(/:\d{2}\.\d{3}Z$/, ':00Z');

  return request({
    method: 'POST',
    path: `/missive/campaigns/${campaignId}/`,
    body: {
      campaign: {
        name: campaign.name,
        subject: campaign.subject,
        reply_to: campaign.reply_to,
        from_name: campaign.from_name,
        body_message: campaign.body_message,
        timezone,
        time_to_send: sendAt,
      },
      theme: toThemePayload(theme),
      contact_lists: contactLists.map((list) => list.id),
      organization_address: toOrganizationAddressPayload(organizationMetadata),
      organization_metadata: toOrganizationMetadataPayload(organizationMetadata),
      events: events.map((event) => ({ id: event.id, featured: true })),
      locale,
    },
    referer: campaignRefererUrl(campaignId),
  });
}

/**
 * Cancels a scheduled send, putting the campaign back to draft.
 *
 * saveCampaign cannot do this: omitting `time_to_send` leaves the stored schedule in
 * place (it moves the campaign to "evaluating" and it still goes out), so clearing it
 * takes an explicit null.
 *
 * @param {{campaignId: string}}
 * @returns {Promise<object>} the updated campaign
 */
module.exports.unscheduleCampaign = async ({ campaignId }) => {
  const campaign = await module.exports.getCampaign({ campaignId });
  const [theme, organizationMetadata] = await Promise.all([
    module.exports.getTheme({ themeId: campaign.theme_id }),
    module.exports.getMissiveOrganizationMetadata({ organizationMetadataId: campaign.organization_metadata_id }),
  ]);
  const contactLists = await module.exports.listCampaignContactLists({ campaignId });
  const events = await module.exports.listCampaignEvents({ campaignId });

  return request({
    method: 'POST',
    path: `/missive/campaigns/${campaignId}/`,
    body: {
      campaign: {
        name: campaign.name,
        subject: campaign.subject,
        reply_to: campaign.reply_to,
        from_name: campaign.from_name,
        body_message: campaign.body_message,
        time_to_send: null,
      },
      theme: toThemePayload(theme),
      contact_lists: contactLists.map((list) => list.id),
      organization_address: toOrganizationAddressPayload(organizationMetadata),
      organization_metadata: toOrganizationMetadataPayload(organizationMetadata),
      events: events.map((event) => ({ id: event.id, featured: true })),
      locale: campaign.locale || 'nl_BE',
    },
    referer: campaignRefererUrl(campaignId),
  });
}

/**
 * Deletes a campaign. Handy for clearing out the `(copy N)` drafts that pile up, since
 * every run of promoteEvent.js creates a new one.
 * @param {{campaignId: string}}
 * @returns {Promise<void>}
 */
module.exports.deleteCampaign = async ({ campaignId }) => {
  await request({ method: 'DELETE', path: `/missive/campaigns/${campaignId}/`, referer: campaignRefererUrl(campaignId) });
}

module.exports.campaignEditUrl = (campaignId) => campaignRefererUrl(campaignId);
