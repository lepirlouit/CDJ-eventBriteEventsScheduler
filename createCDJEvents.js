require('dotenv').config();

const { localDateTimeToUTC } = require('./dateUtils');
const eventBriteClient = require("./eventBriteClient");

const ORIGINAL_EVENT_ID = "780148654627"; //CoderDojo Forest (Bruxelles) - 08/06/2024
const startTime = "10:00";
const endTime = "13:00";

const dates = [
  "2024-09-21",
  "2024-10-26",
  "2024-11-09",
  "2024-12-14",
  "2025-01-11",
  "2025-02-08",
  "2025-03-08",
  "2025-04-12",
  "2025-05-24",
  "2025-06-14",
].splice(0, 1);

/**
 * 
 * @param {string} date 
 * @returns {string}
 */
const getNextEventId = async (date) => {
  try {
    const newEventId =  await eventBriteClient.copyEvent({
      endDate: `${date}T${endTime}:00.000Z`,
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
    if (error.name === "INTERNAL_ERROR - The server encountered an internal error.") {
      //TODO : remove eventWith Temp name
      return getNextEventId(date);
    }
  }
}


const main = async () => {
  // const toDay = new Date();
  // const timeZoneOffsetInMilliSeconds = toDay.getTimezoneOffset() * 60 * 1000;
  // const tLocal = toDay + timeZoneOffsetInMilliSeconds;

  const toDay = new Date();

  for (let [index, date] of dates.entries()) {
    const previousEventDate = dates[index - 1] || toDay.toISOString().substring(0, 10);
    // console.log(`${startDateTime} - ${endDateTime}`)
    const newEventId = await getNextEventId(date);
    // const newEventId = "995899932507"; //TODO : to be removed
    const ticketClasses = (await eventBriteClient.listTicketClassesByEvent(newEventId)).ticket_classes;
    for (const ticketClass of ticketClasses) {
      // console.log(ticketClass);
      // console.log(`${ticketClass.sales_start} - ${ticketClass.sales_end}`);
      await eventBriteClient.updateTicketClass({
        eventId: newEventId,
        ticketClassId: ticketClass.id,
        salesStart: `${previousEventDate}T${endTime}:00.000Z`,
        salesEnd: `${date}T${endTime}:00.000Z`,
      });
    }
    const publishDate = `${previousEventDate}T${endTime}:00.000Z`;
    const TEN_MINUTES_IN_MICROSECONDS = 10 * 60 * 1000;
    console.log({ publishDate: localDateTimeToUTC(publishDate), toDay: new Date() })
    console.log("diff : ", localDateTimeToUTC(publishDate).valueOf() - new Date().valueOf());
    if ((localDateTimeToUTC(publishDate).valueOf() - new Date().valueOf()) < TEN_MINUTES_IN_MICROSECONDS) {
      await eventBriteClient.publishEvent({ eventId: newEventId });
    } else {
      await eventBriteClient.schedulePublishDate({ eventId: newEventId, schedulePublishDate: publishDate });
    }
  }
}

main();