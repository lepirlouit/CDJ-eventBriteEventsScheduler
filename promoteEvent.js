require('dotenv').config();
const fs = require("node:fs");
const handlebars = require("handlebars");
const eventBriteClient = require("./eventBriteClient");
const eventBriteWebClient = require("./eventBriteWebClient");

const CAMPAIGN_TO_DUPPLICATE = "46155743"; // CoderDojo 1190 Forest - 08/03/2025 Email Campaign

// Importing the previous event's attendees mutates a contact list shared by the whole
// organization and cannot be undone from here, so it is opt-in.
const IMPORT_PREVIOUS_ATTENDEES = process.argv.includes("--import");
const ATTACH_EVENT = !process.argv.includes("--no-attach-event");

const main = async () => {
  const organizations = await eventBriteClient.listYourOrganizations();
  if (organizations.length > 1) {
    throw new Error("More than one organization for this account");
  }
  const organization = organizations[0];
  const configuredOrganizationId = process.env.EVENTBRITE_ORGANIZATION_ID;
  if (configuredOrganizationId && configuredOrganizationId !== organization.id) {
    throw new Error(`Configured EVENTBRITE_ORGANIZATION_ID (${configuredOrganizationId}) does not match the organization on this token (${organization.id})`);
  }

  // Event selection goes through the web API: the public one ignores status/time_filter
  // /order_by/page_size and just returns every event ever, oldest first.
  const eventsList = await eventBriteWebClient.listOrganizationEvents({
    organizationId: organization.id,
    status: "live,started",
    timeFilter: "current_future",
  });
  if (eventsList.length === 0) {
    throw new Error("No upcoming event to promote");
  }
  if (eventsList.length > 1) {
    throw new Error(`More than one upcoming event (${eventsList.map((upcoming) => upcoming.id).join(", ")})`);
  }
  const event = eventsList[0];
  console.log("Event to promote :", event.id, event.name.text, event.start.local);

  // the previous event, whose attendees we can add to the mailing list
  const [previousEvent] = await eventBriteWebClient.listOrganizationEvents({
    organizationId: organization.id,
    status: "live,started,ended",
    timeFilter: "past",
    orderBy: "start_desc",
    pageSize: 1,
  });
  console.log("Previous event   :", previousEvent.id, previousEvent.name.text, previousEvent.start.local);

  const dateShort = new Intl.DateTimeFormat('fr-BE').format(new Date(event.start.utc)); // 08/03/2025
  const dateLong = new Intl.DateTimeFormat('fr-BE', { dateStyle: 'full' }).format(new Date(event.start.utc)); // samedi 8 mars 2025
  const fileName = new Intl.DateTimeFormat('en-CA').format(new Date(event.start.utc)); // 2025-03-08

  // locale drives the footer / unsubscribe wording. It is nl_BE on a French body on
  // purpose - read it rather than hardcoding it so nobody "fixes" it to fr_BE.
  const { locale } = await eventBriteWebClient.getMissiveSettings({ organizationId: organization.id });

  // copy previous campaign
  const campaign = await eventBriteWebClient.duplicateCampaign({ campaignId: CAMPAIGN_TO_DUPPLICATE, locale });
  // logged before anything else can throw, so a later failure still leaves the id on screen
  console.log("Draft campaign created :", campaign.id, `"${campaign.name}"`);

  const eventUrl = `https://www.eventbrite.be/e/${event.id}`;
  const name = `CoderDojo 1190 Forest - ${dateShort} Email Campaign`;
  const subject = `Ne manquez pas ce nouvel événement de CoderDojoBelgium 1190 Forest - ${dateLong}`;

  const bodyMessageTemplate = fs.readFileSync("./campaignBodyTemplate.html").toString();
  const compiledTemplate = handlebars.compile(bodyMessageTemplate);
  const bodyMessage = compiledTemplate({
    dateLong,
    eventUrl,
  });
  console.log("Campaign name :", name);
  console.log("subject :", subject);

  const path = `./campaignBodyTemplate-${fileName}.html`;
  fs.writeFileSync(path, bodyMessage);
  console.log("body path :", path);

  const [theme, organizationMetadata] = await Promise.all([
    eventBriteWebClient.getTheme({ themeId: campaign.theme_id }),
    eventBriteWebClient.getMissiveOrganizationMetadata({ organizationMetadataId: campaign.organization_metadata_id }),
  ]);

  // one source of truth for both the preview and the save, so they cannot render differently
  const eventIds = ATTACH_EVENT ? [event.id] : [];

  // render what the recipient would see, without saving anything
  const preview = await eventBriteWebClient.previewCampaign({
    campaignId: campaign.id,
    theme,
    organizationMetadata,
    bodyMessage,
    eventIds,
    locale,
  });
  const previewPath = `./campaignPreview-${fileName}.html`;
  fs.writeFileSync(previewPath, preview);
  console.log("preview path :", previewPath);

  // the duplicate keeps the original's contact lists
  const contactLists = await eventBriteWebClient.listCampaignContactLists({ campaignId: campaign.id });
  if (contactLists.length === 0) {
    console.log("\tWARNING : no contact list on this campaign, it would be sent to nobody");
  }
  // counts are eventually consistent, they are here to eyeball not to assert on
  console.log("Audience :", contactLists.map((list) => `${list.name} (${list.active_subscribers_count})`).join(", ") || "NONE");

  if (IMPORT_PREVIOUS_ATTENDEES) {
    for (const contactList of contactLists) {
      console.log(`\tImport attendees of ${previousEvent.id} into "${contactList.name}"`);
      const stats = await eventBriteWebClient.importContactsFromEventsAndWait({
        contactListId: contactList.id,
        eventIds: [previousEvent.id],
        campaignId: campaign.id,
      });
      console.log(`\t\tcreated ${stats.created}/${stats.total} (failed ${stats.failed})`);
    }
  } else {
    console.log("\t(skipped attendee import, pass --import to add the previous event's attendees)");
  }

  // update name, subject and body. This is a full replace of the editor state, so the
  // theme / metadata / contact lists read above are passed straight back in.
  await eventBriteWebClient.saveCampaign({
    campaignId: campaign.id,
    campaign: {
      name,
      subject,
      from_name: campaign.from_name,
      reply_to: campaign.reply_to,
      body_message: bodyMessage,
    },
    theme,
    organizationMetadata,
    contactListIds: contactLists.map((list) => list.id),
    eventIds,
    locale,
  });

  const savedCampaign = await eventBriteWebClient.getCampaign({ campaignId: campaign.id });
  if (savedCampaign.name !== name || savedCampaign.subject !== subject || savedCampaign.body_message !== bodyMessage) {
    console.log("\tWARNING : the saved campaign does not match what was sent, check it in the UI");
  }
  // hard guard : this script must never queue a campaign for delivery
  if (savedCampaign.status !== "draft" || savedCampaign.time_to_send !== null) {
    throw new Error(`Campaign ${campaign.id} is "${savedCampaign.status}" with time_to_send ${JSON.stringify(savedCampaign.time_to_send)} - it should still be a draft. Check it in the UI NOW.`);
  }
  console.log("Saved :", `status=${savedCampaign.status}`, `time_to_send=${savedCampaign.time_to_send}`);

  const attachedEvents = await eventBriteWebClient.listCampaignEvents({ campaignId: campaign.id });
  console.log("Attached events :", attachedEvents.map((attached) => attached.id).join(", ") || "NONE");

  // Sending is intentionally manual - this script stops at a reviewable draft.
  console.log(`
---
Draft ready for review :
  ${eventBriteWebClient.campaignEditUrl(campaign.id)}

Still to do by hand in the UI :
  [ ] check the body renders as expected (${previewPath})${attachedEvents.length === 0 ? `
  [ ] attach the event ${event.id}` : ''}
  [ ] check the audience
  [ ] Send / Schedule`);
};

main();
