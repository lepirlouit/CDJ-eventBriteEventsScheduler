require('dotenv').config();

const { localDateTimeToUTC } = require('./dateUtils');
const eventBriteClient = require("./eventBriteClient");

const ORIGINAL_EVENT_ID = "780148654627"; //CoderDojo Forest (Bruxelles) - 08/06/2024
const startTime = "10:00";
const endTime = "13:00";

// date of the last event already created on Eventbrite, used as sales start / publish
// date for the first date below. Set to null when starting a fresh season.
const LAST_CREATED_EVENT_DATE = null;

const dates = [
  "2026-09-12",
  "2026-10-17",
  "2026-11-21",
  "2026-12-19",
  "2027-01-17", // zondag (speelzondag is in de namiddag)
  "2027-02-13",
  "2027-03-20",
  "2027-04-10",
  "2027-05-22",
  "2027-06-12",
];

const MAX_COPY_ATTEMPTS = 5;

/**
 * 
 * @param {string} date 
 * @param {number} [attempt]
 * @returns {string}
 */
const getNextEventId = async (date, attempt = 1) => {
  try {
    const newEventId =  await eventBriteClient.copyEvent({
      endDate: `${date}T${endTime}:00.000Z`,
      // copy event is created with temp name, because sometime it fail and doesn't copy the full event
      name: `CoderDojo Forest (Bruxelles) TO_BE_REMOVED`,
      originalEventId: ORIGINAL_EVENT_ID,
      startDate: `${date}T${startTime}:00.000Z`,
    });
    await eventBriteClient.updateEventName({
      eventId: newEventId,
      name: `CoderDojo Forest (Bruxelles) ${new Intl.DateTimeFormat('fr-BE').format(new Date(date))}`,
    });
    return newEventId;
  } catch (error) {
    // eventBriteClient throws `new Error("<error> - <error_description>")`, so the
    // eventbrite error code is in the message, not in the name
    console.log(`\tCopy event failed [${error.message}]`);
    if (error.message.startsWith("INTERNAL_ERROR") && attempt < MAX_COPY_ATTEMPTS) {
      console.log(`\t\tRetry copy event (${attempt + 1}/${MAX_COPY_ATTEMPTS})`)
      //TODO : remove eventWith Temp name
      return getNextEventId(date, attempt + 1);
    }
    throw error;
  }
}


const main = async () => {
  for (let [index, date] of dates.entries()) {
    console.log("Next CoderDojo : ", date);
    const previousEventDate = dates[index - 1] || LAST_CREATED_EVENT_DATE || new Date().toISOString().substring(0, 10);
    const newEventId = await getNextEventId(date);
    // const newEventId = "995899932507"; //TODO : to be removed
    const ticketClasses = (await eventBriteClient.listTicketClassesByEvent(newEventId)).ticket_classes;
    for (const ticketClass of ticketClasses) {
      console.log("\tUpdate ticket class :", ticketClass.id, ticketClass.name);
      await eventBriteClient.updateTicketClass({
        eventId: newEventId,
        ticketClassId: ticketClass.id,
        salesStart: `${previousEventDate}T${endTime}:00.000Z`,
        salesEnd: `${date}T${endTime}:00.000Z`,
      });
    }
    const publishDate = `${previousEventDate}T${endTime}:00.000Z`;
    const TEN_MINUTES_IN_MICROSECONDS = 10 * 60 * 1000;
    if ((localDateTimeToUTC(publishDate).valueOf() - new Date().valueOf()) < TEN_MINUTES_IN_MICROSECONDS) {
      console.log("\tpublish now");
      await eventBriteClient.publishEvent({ eventId: newEventId });
    } else {
      console.log("\tpublish date :", localDateTimeToUTC(publishDate));
      await eventBriteClient.schedulePublishDate({ eventId: newEventId, schedulePublishDate: publishDate });
    }
  }
}

main();