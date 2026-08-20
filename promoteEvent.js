require('dotenv').config();
const fs = require("node:fs");
const handlebars = require("handlebars");
const eventBriteClient = require("./eventBriteClient");

const CAMPAIGN_TO_DUPPLICATE = "29077159"; // CoderDojo 1190 Forest - 08/06/2024 Email Campaign

const main = async () => {
  const organizations = await eventBriteClient.listYourOrganizations();
  if (organizations.length > 1) {
    throw new Error("More than one organization for this account");
  }
  const organization = organizations[0];
  // list events
  const eventsList = await eventBriteClient.listEventsByOrganization({ organizationId: organization.id, status: "live,started,ended,canceled", timeFilter: "current_future" });
  if (eventsList.length > 1) {
    throw new Error("More than one upcoming event");
  }
  const event = eventsList[0];
  console.log(JSON.stringify(event, null, 2));
  // (ask which event to promote (show only upcoming published events))
  // copy previous campaign
  // const campaignCopy = await eventBriteClient.copyEmailCampaign({ campaignId: CAMPAIGN_TO_DUPPLICATE });
  const dateShort = new Intl.DateTimeFormat('fr-BE').format(new Date(event.start.utc)); // dd/MM/YYYY
  const dateLong = new Intl.DateTimeFormat('fr-BE', {dateStyle: 'full'}).format(new Date(event.start.utc)); // '21 septembre 2024'
  const dateFull = new Intl.DateTimeFormat('fr-BE', { dateStyle: 'full' }).format(new Date(event.start.utc)); // samedi 21 septembre 2024
  const fileName = new Intl.DateTimeFormat('en-CA').format(new Date(event.start.utc)); 
  
  const eventUrl = `https://www.eventbrite.be/e/${event.id}`;
  const name = `CoderDojo 1190 Forest - ${dateShort} Email Campaign`;
  const subject = `Ne manquez pas ce nouvel événement de CoderDojoBelgium 1190 Forest - ${dateFull}`;

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
  console.log("path :", path);

  // update dates in title (X2) and content (X2/3)
  // await eventBriteClient.updateCampaign({ campaignId: campaignCopy.id, name, subject, bodyMessage });
  // ask if need to add/enrich list with emails of previous event
  // if yes, list previous events (default is latest)
  // Ask for schedule the campain or to send now
  // done.
};

main();