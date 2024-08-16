const { dateToDateStr } = require('./dateUtils');
/**
 * 
 * @param {{originalEventId: string, name: string, startDate: string, endDate: string}} 
 * @returns 
 */
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
/**
 * 
 * @param {{eventId: string, schedulePublishDate: string}} 
 * @returns 
 */
module.exports.schedulePublishDate = async ({ eventId, schedulePublishDate }) => {
  const response = await fetch(`https://www.eventbriteapi.com/v3/events/${eventId}/publish_settings/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.EVENTBRITE_Private_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      publish_settings: {
        schedule_publish_date: dateToDateStr(schedulePublishDate),
      }
    }),
  });
  const data = await response.json();
  if (response.ok) {
    return;
  }

  throw new Error(`${data.error} - ${data.error_description}`)
}


/**
 * 
 * @param {{eventId: string, name:string}}
 * @returns 
 */
module.exports.publishEvent = async ({ eventId }) => {
  const response = await fetch(`https://www.eventbriteapi.com/v3/events/${eventId}/publish/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.EVENTBRITE_Private_token}`,
      'Content-Type': 'application/json'
    },
  });
  const data = await response.json();
  if (response.ok) {
    return;
  }

  throw new Error(`${data.error} - ${data.error_description}`)
}

/**
 * 
 * @param {{eventId: string}}
 * @returns 
 */
module.exports.getEvent = async ({ eventId }) => {
  const response = await fetch(`https://www.eventbriteapi.com/v3/events/${eventId}/`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.EVENTBRITE_Private_token}`,
      'Content-Type': 'application/json'
    },
  });
  const data = await response.json();
  if (response.ok) {
    return data;
  }

  throw new Error(`${data.error} - ${data.error_description}`)
}
/**
 * 
 * @param {{eventId: string}}
 * @returns 
 */
module.exports.updateEventName = async ({ eventId, name }) => {
  const response = await fetch(`https://www.eventbriteapi.com/v3/events/${eventId}/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.EVENTBRITE_Private_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      event: {
        name: {
          html: name,
        },
      }
    }),
  });
  const data = await response.json();
  if (response.ok) {
    return;
  }

  throw new Error(`${data.error} - ${data.error_description}`)
}



