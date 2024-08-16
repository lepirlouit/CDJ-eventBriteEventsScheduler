require('dotenv').config();

const eventBriteClient = require("./eventBriteClient");

const ORIGINAL_EVENT_ID = "780148654627"; //CoderDojo Forest (Bruxelles) - 08/06/2024

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



const main = async () => {
  // const toDay = new Date();
  // const timeZoneOffsetInMilliSeconds = toDay.getTimezoneOffset() * 60 * 1000;
  // const tLocal = toDay + timeZoneOffsetInMilliSeconds;

  const startTime = "10:00";
  const endTime = "13:00";
  const toDay = new Date();

  for (let [index, date] of dates.entries()) {
    const previousEventDate = dates[index - 1] || toDay.toISOString().substring(0, 10);
    // console.log(`${startDateTime} - ${endDateTime}`)
    // const newEventId = await eventBriteClient.copyEvent({
    //   endDate: `${date}T${endTime}:00.000Z`,
    //   name: `CoderDojo Forest (Bruxelles) ${"------"}`,
    //   originalEventId: ORIGINAL_EVENT_ID,
    //   startDate: `${date}T${startTime}:00.000Z`,
    // });
    const newEventId = "995899932507"; //TODO : to be removed
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
  }
}

main();