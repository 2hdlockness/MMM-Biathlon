const NodeHelper = require("node_helper");
const fs = require("fs");

module.exports = NodeHelper.create({
  start: function () {
    console.log("[MMM-Biathlon] NodeHelper started.");
    this.config = {};
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "GET_BIATHLON_EVENTS") {
      this.getBiathlonEvents(payload.seasonid, payload.eventClassificationIds);
    }
  },

  getBiathlonEvents: async function (seasonid, eventClassificationIds) {
    console.log("[MMM-Biathlon] Retrieving events for the season:", seasonid);

    this.config = this.config || {};
    this.config.EventClassificationId = eventClassificationIds;

    const url = `https://biathlonresults.com/modules/sportapi/api/Events?SeasonId=${seasonid}&Level=ALL`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      
      const events = await response.json();
      const userEventIds = this.config.EventClassificationId || [];
      const eventsByClassification = new Map();

      events.forEach((event) => {
        if (userEventIds.includes(event.EventClassificationId)) {
          const classificationId = event.EventClassificationId;
          const eventStartDate = new Date(event.StartDate);
          const now = new Date();

          if (!eventsByClassification.has(classificationId)) {
            eventsByClassification.set(classificationId, { nextEvent: null, lastEvent: null });
          }

          const classificationEvents = eventsByClassification.get(classificationId);

          if (eventStartDate > now) {
            if (!classificationEvents.nextEvent || eventStartDate < new Date(classificationEvents.nextEvent.StartDate)) {
              classificationEvents.nextEvent = event;
            }
          } else {
            if (!classificationEvents.lastEvent || eventStartDate > new Date(classificationEvents.lastEvent.StartDate)) {
              classificationEvents.lastEvent = event;
            }
          }
        }
      });

      const nextEvents = [];
      eventsByClassification.forEach((events) => {
        if (events.nextEvent) {
          nextEvents.push(events.nextEvent);
        }
      });

      console.log("[MMM-Biathlon] Next events:\n" + 
        nextEvents.map(event => `${event.EventId} - ${event.Description}`).join("\n")
      );

      for (const [classificationId, events] of eventsByClassification.entries()) {
        if (events.nextEvent) {
          this.sendSocketNotification("BIATHLON_NEXT_EVENT", { nextevent: events.nextEvent });
        }

        if (events.lastEvent) {
          console.log("[MMM-Biathlon] Directly retrieving competitions for the last event:\n" +
            `${events.lastEvent.EventId} - ${events.lastEvent.Description}`
          );
          await this.getCompetitions(events.lastEvent.EventId);
        } else {
          console.log("[MMM-Biathlon] No last event found for EventClassificationId", classificationId);
        }
      }
    } catch (error) {
      console.error("[MMM-Biathlon] Error retrieving events:", error);
      this.sendSocketNotification("BIATHLON_NEXT_EVENT", { nextevent: null });
    }
  },

  getCompetitions: async function (eventId) {
    const url = `https://biathlonresults.com/modules/sportapi/api/Competitions?EventId=${eventId}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      
      const competitions = await response.json();
      if (competitions && competitions.length > 0) {
        await this.getResultsForCompetitions(competitions);
      } else {
        console.log("[MMM-Biathlon] No competitions found for this event.");
      }
    } catch (error) {
      console.error("[MMM-Biathlon] Error retrieving competitions:", error);
    }
  },

  getResultsForCompetitions: async function (competitions) {
    try {
      const resultsPromises = competitions.map(async (competition) => {
        const raceId = competition.RaceId;
        const url = `https://biathlonresults.com/modules/sportapi/api/Results?RaceId=${raceId}`;

        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
          
          const raceData = await response.json();
          const inforace = {
            StartTime: raceData.Competition.StartTime,
            ShortDescription: raceData.Competition.ShortDescription,
            Organizer: raceData.SportEvt.Organizer,
            Description: raceData.SportEvt.Description
          };

          const resultrace = raceData.Results.map((result) => ({
            Rank: result.Rank,
            Name: result.Name,
            Nat: result.Nat,
            TotalTime: result.TotalTime,
            Shootings: result.Shootings
          }));

          const resultracerelay = [];
          if (['MXRL', 'MXSR', 'SWRL', 'SMRL', 'YXSR', 'YXRL', 'JXRL', 'JXSR', 'YWRL', 'YMRL', 'JWRL', 'JMRL'].some(suffix => raceId.endsWith(suffix))) {
            const uniqueResults = new Map();
            resultrace.forEach((result) => {
              if (!uniqueResults.has(result.Rank)) {
                uniqueResults.set(result.Rank, result);
                resultracerelay.push(result);
              }
            });
          }

          this.sendSocketNotification("BIATHLON_RACE_RESULTS", { inforace, resultrace, resultracerelay });
        } catch (error) {
          console.error("[MMM-Biathlon] Error retrieving race results:", raceId, error);
        }
      });

      await Promise.all(resultsPromises);
      console.log("[MMM-Biathlon] All race results have been retrieved.");
    } catch (error) {
      console.error("[MMM-Biathlon] Error retrieving race results:", error);
    }
  },
});
