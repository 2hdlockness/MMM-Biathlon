
const NodeHelper = require("node_helper");

const BASE_URL = "https://biathlonresults.com/";
const API_URL = `${BASE_URL}modules/sportapi/api/`;

const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/157.0.0.0 Safari/537.36",
  "Referer": BASE_URL,
  "Accept": "application/json, text/plain, */*"
};

const RELAY_SUFFIXES = [
  "MXRL", "MXSR", "SWRL", "SMRL",
  "YXSR", "YXRL", "JXRL", "JXSR",
  "YWRL", "YMRL", "JWRL", "JMRL"
];

module.exports = NodeHelper.create({

  start: function () {
    console.log("[MMM-Biathlon] NodeHelper started.");

    this.config = {};
    this.apiKey = null;
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "GET_BIATHLON_EVENTS") {
      this.getBiathlonEvents(
        payload.seasonid,
        payload.eventClassificationIds
      );
    }
  },

  // --------------------------------------------------
  // RÉCUPÉRATION AUTOMATIQUE DE LA CLÉ API IBU
  // --------------------------------------------------

  getApiKey: async function (forceRefresh = false) {

    if (this.apiKey && !forceRefresh) {
      return this.apiKey;
    }

    console.log("[MMM-Biathlon] Recherche de la clé API IBU...");

    const pageResponse = await fetch(BASE_URL, {
      headers: REQUEST_HEADERS
    });

    if (!pageResponse.ok) {
      throw new Error(
        `Impossible d'accéder au site IBU : HTTP ${pageResponse.status}`
      );
    }

    const html = await pageResponse.text();

    // Accepte les trois syntaxes :
    // src="fichier.js"
    // src='fichier.js'
    // src=fichier.js
    const scriptRegex =
      /<script\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;

    const scripts = [];
    let match;

    while ((match = scriptRegex.exec(html)) !== null) {

      const src = match[1] || match[2] || match[3];

      if (!src) continue;

      const scriptUrl = new URL(src, BASE_URL);

      if (/\.js$/i.test(scriptUrl.pathname)) {
        scripts.push(scriptUrl.href);
      }
    }

    // Évite de télécharger plusieurs fois le même fichier.
    const uniqueScripts = [...new Set(scripts)];

    console.log(
      `[MMM-Biathlon] ${uniqueScripts.length} fichiers JavaScript détectés.`
    );

    // Les fichiers applicatifs sont examinés en priorité.
    uniqueScripts.sort((a, b) => {
      const aIsApp = /app/i.test(a);
      const bIsApp = /app/i.test(b);

      return Number(bIsApp) - Number(aIsApp);
    });

    for (const scriptUrl of uniqueScripts) {

      try {

        const response = await fetch(scriptUrl, {
          headers: REQUEST_HEADERS
        });

        if (!response.ok) {
          continue;
        }

        const scriptContent = await response.text();

        // Recherche de la clé API dans les fichiers JavaScript.
        const keyPatterns = [
          /(?:window\s*\.\s*)?ApiKey\s*[:=]\s*["']([0-9a-fA-F-]{36})["']/i,
          /["']ApiKey["']\s*:\s*["']([0-9a-fA-F-]{36})["']/i,
          /apiKey\s*[:=]\s*["']([0-9a-fA-F-]{36})["']/i
        ];

        for (const pattern of keyPatterns) {

          const keyMatch = scriptContent.match(pattern);

          if (keyMatch) {

            this.apiKey = keyMatch[1];

            console.log(
              "[MMM-Biathlon] Clé API IBU récupérée automatiquement."
            );

            console.log(
              "[MMM-Biathlon] Fichier source :",
              scriptUrl.split("/").pop()
            );

            return this.apiKey;
          }
        }

      } catch (error) {

        console.warn(
          "[MMM-Biathlon] Impossible de lire le script :",
          scriptUrl.split("/").pop(),
          error.message
        );

      }
    }

    throw new Error(
      "Clé API IBU introuvable dans les fichiers JavaScript du site."
    );
  },

  // --------------------------------------------------
  // REQUÊTES API AVEC AUTHENTIFICATION ET RENOUVELLEMENT
  // --------------------------------------------------

  apiRequest: async function (endpoint, params = {}) {

    const url = new URL(endpoint, API_URL);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    for (let attempt = 0; attempt < 2; attempt++) {

      if (!this.apiKey || attempt === 1) {
        this.apiKey = null;
        await this.getApiKey(true);
      }

      const headers = {
        ...REQUEST_HEADERS,
        apikey: this.apiKey
      };

      const response = await fetch(url, { headers });

      // Si la clé est refusée, on la récupère à nouveau.
      if (response.status === 401 && attempt === 0) {

        console.warn(
          "[MMM-Biathlon] Clé API refusée. Renouvellement..."
        );

        this.apiKey = null;
        continue;
      }

      if (!response.ok) {
        throw new Error(
          `Erreur API IBU : HTTP ${response.status} (${endpoint})`
        );
      }

      return await response.json();
    }

    throw new Error(
      "Authentification IBU impossible après renouvellement de la clé."
    );
  },

  // --------------------------------------------------
  // RÉCUPÉRATION DES ÉVÉNEMENTS
  // --------------------------------------------------

  getBiathlonEvents: async function (
    seasonid,
    eventClassificationIds
  ) {

    console.log(
      "[MMM-Biathlon] Retrieving events for the season:",
      seasonid
    );

    this.config.EventClassificationId = eventClassificationIds || [];

    try {

      const events = await this.apiRequest("Events", {
        SeasonId: seasonid,
        Level: "ALL"
      });

      if (!Array.isArray(events)) {
        throw new Error("Format des événements IBU inattendu.");
      }

      const userEventIds = this.config.EventClassificationId;
      const eventsByClassification = new Map();

      const now = new Date();

      events.forEach((event) => {

        if (!userEventIds.includes(event.EventClassificationId)) {
          return;
        }

        const classificationId = event.EventClassificationId;
        const eventStartDate = new Date(event.StartDate);

        if (!eventsByClassification.has(classificationId)) {
          eventsByClassification.set(classificationId, {
            nextEvent: null,
            lastEvent: null
          });
        }

        const classificationEvents =
          eventsByClassification.get(classificationId);

        if (eventStartDate > now) {

          if (
            !classificationEvents.nextEvent ||
            eventStartDate <
              new Date(classificationEvents.nextEvent.StartDate)
          ) {
            classificationEvents.nextEvent = event;
          }

        } else {

          if (
            !classificationEvents.lastEvent ||
            eventStartDate >
              new Date(classificationEvents.lastEvent.StartDate)
          ) {
            classificationEvents.lastEvent = event;
          }

        }

      });

      const nextEvents = [];

      eventsByClassification.forEach((classificationEvents) => {
        if (classificationEvents.nextEvent) {
          nextEvents.push(classificationEvents.nextEvent);
        }
      });

      console.log(
        "[MMM-Biathlon] Next events:\n" +
        nextEvents.map(event =>
          `${event.EventId} - ${event.Description}`
        ).join("\n")
      );

      for (const [classificationId, classificationEvents]
        of eventsByClassification.entries()) {

        if (classificationEvents.nextEvent) {

          this.sendSocketNotification(
            "BIATHLON_NEXT_EVENT",
            {
              nextevent: classificationEvents.nextEvent
            }
          );

        }

        if (classificationEvents.lastEvent) {

          console.log(
            "[MMM-Biathlon] Directly retrieving competitions for the last event:\n" +
            `${classificationEvents.lastEvent.EventId} - ${classificationEvents.lastEvent.Description}`
          );

          await this.getCompetitions(
            classificationEvents.lastEvent.EventId
          );

        } else {

          console.log(
            "[MMM-Biathlon] No last event found for EventClassificationId",
            classificationId
          );

        }

      }

    } catch (error) {

      console.error(
        "[MMM-Biathlon] Error retrieving events:",
        error
      );

      this.sendSocketNotification(
        "BIATHLON_NEXT_EVENT",
        { nextevent: null }
      );

    }

  },

  // --------------------------------------------------
  // RÉCUPÉRATION DES COMPÉTITIONS
  // --------------------------------------------------

  getCompetitions: async function (eventId) {

    try {

      const competitions = await this.apiRequest("Competitions", {
        EventId: eventId
      });

      if (competitions && competitions.length > 0) {

        console.log(
          "[MMM-Biathlon] Competitions found:",
          competitions.length
        );

        await this.getResultsForCompetitions(competitions);

      } else {

        console.log(
          "[MMM-Biathlon] No competitions found for this event."
        );

      }

    } catch (error) {

      console.error(
        "[MMM-Biathlon] Error retrieving competitions:",
        error
      );

    }

  },

  // --------------------------------------------------
  // RÉCUPÉRATION DES RÉSULTATS
  // --------------------------------------------------

  getResultsForCompetitions: async function (competitions) {

    try {

      const resultsPromises = competitions.map(async (competition) => {

        const raceId = competition.RaceId;

        try {

          const raceData = await this.apiRequest("Results", {
            RaceId: raceId
          });

          if (
            !raceData ||
            !raceData.Competition ||
            !Array.isArray(raceData.Results)
          ) {
            throw new Error("Structure des résultats IBU inattendue.");
          }

          const inforace = {
            StartTime: raceData.Competition.StartTime,
            ShortDescription: raceData.Competition.ShortDescription,
            Organizer: raceData.SportEvt?.Organizer,
            Description: raceData.SportEvt?.Description
          };

          const resultrace = raceData.Results.map((result) => ({
            Rank: result.Rank,
            Name: result.Name,
            Nat: result.Nat,
            TotalTime: result.TotalTime,
            Shootings: result.Shootings
          }));

          const resultracerelay = [];

          if (
            RELAY_SUFFIXES.some(suffix => raceId.endsWith(suffix))
          ) {

            const uniqueResults = new Map();

            resultrace.forEach((result) => {

              if (!uniqueResults.has(result.Rank)) {

                uniqueResults.set(result.Rank, result);
                resultracerelay.push(result);

              }

            });

          }

          this.sendSocketNotification(
            "BIATHLON_RACE_RESULTS",
            {
              inforace,
              resultrace,
              resultracerelay
            }
          );

          console.log(
            "[MMM-Biathlon] Results retrieved:",
            raceId
          );

        } catch (error) {

          console.error(
            "[MMM-Biathlon] Error retrieving race results:",
            raceId,
            error
          );

        }

      });

      await Promise.all(resultsPromises);

      console.log(
        "[MMM-Biathlon] All race results have been retrieved."
      );

    } catch (error) {

      console.error(
        "[MMM-Biathlon] Error retrieving race results:",
        error
      );

    }

  }

});
