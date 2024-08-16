const localDateTimeToUTC = (dateStr) => {
  const date = new Date(dateStr);
  const timeZoneOffsetInMilliSeconds = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.valueOf() + timeZoneOffsetInMilliSeconds);
}
const dateToDateStr = (date) =>
  localDateTimeToUTC(date).toISOString().replace(/\.000/, '');

module.exports.copyEvent = async ({ originalEventId, name, startDate, endDate }) => {
  const response = await fetch(`https://www.eventbriteapi.com/v3/events/${originalEventId}/copy/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.EVENTBRITE_Private_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      start_date: dateToDateStr(startDate),
      end_date: dateToDateStr(endDate),
      name,
      timezone: "Europe/Brussels"
    })
  });
  const data = await response.json();
  if (response.ok) {
    const { id: eventId } = data;
    return eventId;
  }

  throw new Error(`${data.error} - ${data.error_description}`);
}
module.exports.usersMe = async () => {
  const response = await fetch(`https://www.eventbriteapi.com/v3/users/me/`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.EVENTBRITE_Private_token}`,
      'Content-Type': 'application/json'
    },
  });
  const data = await response.json();
  return data;
}
module.exports.listTicketClassesByEvent = async (eventId) => {
  const response = await fetch(`https://www.eventbriteapi.com/v3/events/${eventId}/ticket_classes/`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.EVENTBRITE_Private_token}`,
      'Content-Type': 'application/json'
    },
  });
  const data = await response.json();
  return data;
}
module.exports.updateTicketClass = async ({ eventId, ticketClassId, salesStart, salesEnd }) => {
  console.log({
    sales_start: dateToDateStr(salesStart),
    sales_end: dateToDateStr(salesEnd),
  });
  const response = await fetch(`https://www.eventbriteapi.com/v3/events/${eventId}/ticket_classes/${ticketClassId}/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.EVENTBRITE_Private_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ticket_class: {
        sales_start: dateToDateStr(salesStart),
        sales_end: dateToDateStr(salesEnd),
      }
    }),
  });
  const data = await response.json();
  if (response.ok) {
    return;
  }

  throw new Error(`${data.error} - ${data.error_description}`)
}