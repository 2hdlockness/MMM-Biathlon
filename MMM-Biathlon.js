Module.register("MMM-Biathlon", {
  defaults: {
    seasonid: "2425",
    showNextEvent: true,
	showtime: true,
	showshoot: true,
    maximumEntries: 5,
    transitionInterval: 20000,
    updateInterval: 3600000,
    EventClassificationId: ["BTSWRLCP","BTSWRLCH"]
  },
  
	getTranslations: function() {
		const translations = {
			fr: "translations/fr.json",
			it: "translations/it.json",
			de: "translations/de.json",
			es: "translations/es.json",
			no: "translations/no.json",
			zh: "translations/zh.json"
		};

		if (translations[config.language]) {
			return { [config.language]: translations[config.language] };
		}

		return {};
	},

  getStyles: function() {
    return ["MMM-Biathlon.css", "https://cdn.jsdelivr.net/npm/flag-icons/css/flag-icons.min.css"];
  },

  getScripts: function() {
    return ["moment.js"];
  },

  start: function () {
    console.log("[MMM-Biathlon] Module started");
    this.nextevent = [];
    this.raceResults = [];
    this.currentRaceIndex = 0;
    this.currentEventIndex = 0;
    this.ibuIdNameMapping = {};
    this.eventsLastFetched = 0;
    
    fetch('modules/MMM-Biathlon/resources/IbuIdName.json')
      .then(response => response.json())
      .then(data => {
        this.ibuIdNameMapping = data.reduce((acc, item) => {
          acc[item.IBUId] = item.Name;
          return acc;
        }, {});
      });

    this.requestEvents();

    setInterval(() => {
      this.requestEvents();
    }, this.config.updateInterval);

    setInterval(() => {
      if (this.raceResults.length > 0) {
        this.currentRaceIndex = (this.currentRaceIndex + 1) % this.raceResults.length;
        this.updateDomIfNeeded();
      }
    }, this.config.transitionInterval);

    setInterval(() => {
      if (this.nextevent && this.nextevent.length > 1) {
        this.currentEventIndex = (this.currentEventIndex + 1) % this.nextevent.length;
        this.updateDomIfNeeded();
      }
    }, this.config.transitionInterval);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "BIATHLON_NEXT_EVENT") {
      if (payload && payload.nextevent && !this.nextevent.some(event => event.EventId === payload.nextevent.EventId)) {
        this.nextevent.push(payload.nextevent);
        this.sortNextEvents();
      }
    }

    if (notification === "BIATHLON_RACE_RESULTS") {
      if (payload && payload.inforace && Array.isArray(payload.resultrace)) {
        this.raceResults.push({
          inforace: payload.inforace,
          resultrace: payload.resultrace.sort((a, b) => a.Rank - b.Rank),
          resultracerelay: payload.resultracerelay,
        });
        this.sortRaceResults();
      }
    }
  },

  requestEvents: function() {
    const now = Date.now();
    if (now - this.eventsLastFetched > this.config.updateInterval) {
      this.sendSocketNotification("GET_BIATHLON_EVENTS", {
        seasonid: this.config.seasonid,
        eventClassificationIds: this.config.EventClassificationId,
      });
      this.eventsLastFetched = now;
    }
  },

  sortNextEvents: function() {
    this.nextevent.sort((a, b) => {
      if (a.EventClassificationId !== b.EventClassificationId) {
        return a.EventClassificationId.localeCompare(b.EventClassificationId);
      }
      return new Date(a.StartDate) - new Date(b.StartDate);
    });
    this.updateDomIfNeeded();
  },

  sortRaceResults: function() {
    this.raceResults.sort((a, b) => new Date(a.inforace.StartTime) - new Date(b.inforace.StartTime));
    this.updateDomIfNeeded();
  },

  updateDomIfNeeded: function() {
    const raceChanged = this.raceResults.length > 0 && this.currentRaceIndex < this.raceResults.length;
    const eventChanged = this.nextevent.length > 0 && this.currentEventIndex < this.nextevent.length;
    if (raceChanged || eventChanged) {
      this.updateDom();
    }
  },

  getDom: function () {
    const wrapper = document.createElement("div");

    if (this.raceResults.length === 0) {
      wrapper.innerHTML = this.translate("LOADING");
      wrapper.classList.add("dimmed", "light", "small");
      return wrapper;
    }

    const race = this.raceResults[this.currentRaceIndex];

    const countryCodeCorrections = {
      "sw": "se", "uk": "ua", "su": "ch",
      "bu": "bg", "po": "pl", "ka": "kz",
      "ko": "kr", "ge": "de"
    };

    const raceDiv = document.createElement("div");
    raceDiv.classList.add("biathlon-race-results");
    raceDiv.innerHTML = `
	<div class="biathlon-race-title">
		${this.translate(race.inforace.Description)}<br>
		${this.translate(race.inforace.ShortDescription)} - ${new Date(race.inforace.StartTime).toLocaleDateString(config.locale)}<br><span class="organizer">(${race.inforace.Organizer})</span>
	</div>
      <table class="biathlon-results-table">
        <tbody>
          ${
            race.resultracerelay.length === 0
            ? race.resultrace
                .filter(result => result.Rank !== null)
                .slice(0, this.config.maximumEntries)
                .map((result) => {
                    let countryCode = result.Nat.toLowerCase().slice(0, 2);
                    if (countryCodeCorrections.hasOwnProperty(countryCode)) {
                        countryCode = countryCodeCorrections[countryCode];
                    }
                    const flagClass = `fi fi-${countryCode}`;
                    const name = this.ibuIdNameMapping[result.Name] || result.Name;

                    return `
                    <tr>
                      <td class="rank">
                        ${parseInt(result.Rank) === 1 ? '<img src="modules/MMM-Biathlon/resources/img/gold.png" class="medal-icon">' :
                          parseInt(result.Rank) === 2 ? '<img src="modules/MMM-Biathlon/resources/img/silver.png" class="medal-icon">' :
                          parseInt(result.Rank) === 3 ? '<img src="modules/MMM-Biathlon/resources/img/bronze.png" class="medal-icon">' :
                          result.Rank || ""}
                      </td>
                      <td><span class="${flagClass} flag-icon"></span></td>
                      <td class="name">${name}</td>
					  ${this.config.showtime ? `<td class="total-time">${result.TotalTime}</td>` : ""}
					  ${this.config.showshoot ? `<td class="shootings">${result.Shootings}</td>` : ""}
                    </tr>`;
                })
                .join("")
            : race.resultracerelay
				.filter(result => result.Rank !== null)
                .slice(0, this.config.maximumEntries)
                .map((result) => {
                    let countryCode = result.Nat.toLowerCase().slice(0, 2);
                    if (countryCodeCorrections.hasOwnProperty(countryCode)) {
                        countryCode = countryCodeCorrections[countryCode];
                    }
                    const flagClass = `fi fi-${countryCode}`;
                    const name = this.ibuIdNameMapping[result.Name] || result.Name;
                    return `
                    <tr>
                      <td class="rank">
                        ${parseInt(result.Rank) === 1 ? '<img src="modules/MMM-Biathlon/resources/img/gold.png" class="medal-icon">' :
                          parseInt(result.Rank) === 2 ? '<img src="modules/MMM-Biathlon/resources/img/silver.png" class="medal-icon">' :
                          parseInt(result.Rank) === 3 ? '<img src="modules/MMM-Biathlon/resources/img/bronze.png" class="medal-icon">' :
                          result.Rank || ""}
                      </td>
                      <td><span class="${flagClass} flag-icon"></span></td>
                      <td class="name">${this.translate(name)}</td>
					  ${this.config.showtime ? `<td class="total-time">${result.TotalTime}</td>` : ""}
					  ${this.config.showshoot ? `<td class="shootings">${result.Shootings}</td>` : ""}
                    </tr>`;
                })
                .join("")
          }
        </tbody>
      </table>
    `;

    wrapper.appendChild(raceDiv);

    if (this.config.showNextEvent && Array.isArray(this.nextevent) && this.nextevent.length > 0) {
      const nextEventDiv = document.createElement("div");
      nextEventDiv.classList.add("biathlon-next-event-wrapper");
      const event = this.nextevent[this.currentEventIndex];
      if (event && event.Description && event.StartDate && event.EndDate) {
        const eventDiv = document.createElement("div");
        eventDiv.classList.add("biathlon-next-event");
        eventDiv.innerHTML = `
	<div>
		
		<img src="modules/MMM-Biathlon/resources/img/calendar.png" class="calendar-icon"> ${this.translate("Next event")}<br>
		${this.translate(event.Description)} - ${this.translate(event.ShortDescription)}<br>
		${new Date(event.StartDate).toLocaleDateString(config.locale)} - ${new Date(event.EndDate).toLocaleDateString(config.locale)} ${this.translate(event.NatLong)}
	</div>
        `;
        nextEventDiv.appendChild(eventDiv);
        wrapper.appendChild(nextEventDiv);
      }
    }

    return wrapper;
  }
});
