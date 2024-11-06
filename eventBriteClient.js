const { dateToDateStr } = require('./dateUtils');
// const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports.listYourOrganizations = async () => {
  const response = await fetch(`https://www.eventbriteapi.com/v3/users/me/organizations/`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.EVENTBRITE_Private_token}`,
      'Content-Type': 'application/json'
    },
  });
  const data = await response.json();
  if (response.ok) {
    // const { id: eventId } = data;
    return data.organizations;
  }

  throw new Error(`${data.error} - ${data.error_description}`);
}

module.exports.listEventsByOrganization = async ({ organizationId, status, timeFilter }) => {
  const queryString = new URLSearchParams({
    show_series_parent: true,
    order_by: "start_asc",
    page: 1,
    page_size: 20,
    app_name: "events-workspace",
    status,
    time_filter: timeFilter,
  }).toString();
  // const queryString = "show_series_parent=true&order_by=start_asc&page=1&page_size=20&app_name=events-workspace&status=live,started,ended,canceled&time_filter=current_future";
  const response = await fetch(`https://www.eventbriteapi.com/v3/organizations/${organizationId}/events/${queryString ? '?' : ''}${queryString}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.EVENTBRITE_Private_token}`,
      'Content-Type': 'application/json'
    },
  });
  const data = await response.json();
  if (response.ok) {
    // const { id: eventId } = data;
    return data.events;
  }

  throw new Error(`${data.error} - ${data.error_description}`);
}

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

module.exports.copyEmailCampaign = async ({ campaignId }) => {
  const response = await fetch("https://www.eventbrite.be/api/v3/missive/campaigns/29077159/duplicate/", {//} `https://www.eventbriteapi.com/v3/missive/campaigns/${campaignId}/duplicate/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.EVENTBRITE_Private_token}`,
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-CSRFToken': "whatever",
      "Cookie": 'mgref=typeins; csrftoken=whatever; stableId=c6d766a9-8a27-45c1-bf61-a224e8edcaf8; G=v%3D2%26i%3Df18348ff-d4ad-4968-995e-355f5dcec7a2%26a%3D1237%26s%3D5570e7d5304e63898f1fe7ac0fe8af54d0d1cddf; eblang=lo%3Dnl_BE%26la%3Dnl-nl; G_ENABLED_IDPS=google; __stripe_mid=061b7577-d0a5-4ac1-899c-f11c8571c93cbe4cd7; mgref=eafil; ajs_user_id=null; ajs_group_id=null; ajs_anonymous_id=%226fe944a1-b791-4e59-9fed-4683484222a8%22; g_state={"i_p":1713519081924,"i_l":1}; location=%7B%22current_place_parent%22%3A%20%22Belgium%22%2C%20%22place_type%22%3A%20%22locality%22%2C%20%22current_place%22%3A%20%22Brussel%22%2C%20%22latitude%22%3A%2050.8509%2C%20%22country%22%3A%20%22Belgium%22%2C%20%22place_id%22%3A%20%22101751573%22%2C%20%22slug%22%3A%20%22belgium--brussel--10471%22%2C%20%22longitude%22%3A%204.3447%7D; mglts=; mglogin2=v%3D3%26uid%3D273908626%26ts%3D1723807664%26n%3Dfnclh7ndsuaxsvxs%26ip%3D185.83.137.249%26p%3D1%26sig%3DAG08tkoBRpeB__BMik404xgMnwZEMdC-tQ; PWE=AFkEbFjo9-e02f6ICg_Q6clyfvKbMRoabqDk4bfyfxXUZbi2fjacw1qMxUOpVS_JqwOPUEoh0tUVSE3cOJWqnIKE2M-nk3EXJl6xZOSJF8lybQT6E17EFHA; mgssl=v%3D1%26sig%3DAIDFc2vZvogv6kaKmIj9aGhqCVoYLq84Qg; mgemail=ANdEhP0VMYIQQ3do8q3oa1sjDn6ZhPuu9J4r8AmnHzEDJHhhmZrvYxPdrcRp8LEUM7s_jwcc6h29; active_organization_id=53624399466; mgaff996602965297=oddtdtcreator; SS=AE3DLHTdSTOEzxdDvttEZftWxN-zw9UBgQ; SP=AGQgbblWB9WIfFQmaoZ5wiD5sL-QAXSErFuNnEjc_e1-mDGGCqQTKnS-qgT6QzJuVduS3vmLOOfFnKRhJ_dgb0Hmwn0PbMJKQtNPq_Kk-oKWnPdNKZ7FbIS6eU0e1N2cG6ERNdjpqlumCkyY8B9d7NviKn4k0YmRZS8d9mARJwKs0O_fkt2VzY4Ec2LTqlCVwC19XJ33y4JJJXHMgyetABXT0KCIhw9uDh3m74NlObTiqhZGn5-8uus; AS=ba7000d5-912d-4296-ad4e-86f80d982b11; django_timezone=Europe/Brussels; __stripe_sid=27d8a618-2996-48e1-8c6e-7b816ebfeb6e5cbac1; _dd_s=rum=0&expire=1725544218102',
      "Referer": "https://www.eventbrite.be/organizations/campaigns/email",
    },
    body: JSON.stringify({
      locale: "nl_BE"
    }),
  });
  const data = await response.json();
  if (response.ok) {
    return;
  }

  throw new Error(`${data.error} - ${data.error_description}`)
}
module.exports.updateCampaign = async ({ campaignId, name, subject, bodyMessage }) => {
  const response = await fetch(`https://www.eventbriteapi.com/v3/missive/campaigns/${campaignId}/duplicate/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.EVENTBRITE_Private_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      campaign: {
        name,
        subject,
        body_message: bodyMessage,
      }
    }),
  });
  const data = await response.json();
  if (response.ok) {
    return;
  }

  throw new Error(`${data.error} - ${data.error_description}`)
}


