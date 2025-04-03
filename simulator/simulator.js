class WeatherSimulator {
  constructor() {
    this.chart = null;
    this.simulationInterval = null;
    this.currentTime = 0;
    this.weatherData = {
      temperature: [],
      humidity: [],
      windSpeed: [],
      precipitation: [],
      time: [],
    };

    this.campaignSettings = {};
    this.initializeChart();
    this.setupEventListeners();
    this.loadCampaignSettings();
  }

  async loadCampaignSettings() {
    try {
      const response = await fetch(
        "http://localhost:8000/campaign_settings/index.json"
      );
      const { campaignSettings } = await response.json();

      for (const campaign of campaignSettings) {
        const campaignResponse = await fetch(
          `http://localhost:8000/campaign_settings/${campaign.path}`
        );
        const campaignData = await campaignResponse.json();
        this.campaignSettings[campaign.id] = campaignData;
      }

      // Update campaign select options
      const campaignSelect = document.getElementById("campaign");
      campaignSelect.innerHTML = campaignSettings
        .map(
          (campaign) =>
            `<option value="${campaign.id}">${campaign.name}</option>`
        )
        .join("");

      // Update options in the correct order
      this.updateSeasonOptions();
      this.updateTerrainOptions();
    } catch (error) {
      console.error("Error loading campaign settings:", error);
      alert(
        "Failed to load campaign settings. Please make sure the local server is running on port 8000."
      );
    }
  }

  initializeChart() {
    const ctx = document.getElementById("weatherChart").getContext("2d");
    this.chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: this.getTemperatureLabel(),
            data: [],
            borderColor: "rgb(255, 99, 132)",
            tension: 0.1,
          },
          {
            label: "Humidity (%)",
            data: [],
            borderColor: "rgb(54, 162, 235)",
            tension: 0.1,
          },
          {
            label: this.getWindSpeedLabel(),
            data: [],
            borderColor: "rgb(153, 102, 255)",
            tension: 0.1,
          },
          {
            label: "Precipitation",
            data: [],
            borderColor: "rgb(75, 192, 192)",
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false,
          },
        },
      },
    });
  }

  setupEventListeners() {
    document
      .getElementById("startSimulation")
      .addEventListener("click", () => this.startSimulation());
    document
      .getElementById("stopSimulation")
      .addEventListener("click", () => this.stopSimulation());
    document.getElementById("campaign").addEventListener("change", () => {
      this.updateSeasonOptions();
      this.updateTerrainOptions();
    });
    document
      .getElementById("season")
      .addEventListener("change", () => this.updateCampaignInfo());
    document
      .getElementById("randomWeather")
      .addEventListener("click", () => this.setRandomWeather());
  }

  updateTerrainOptions() {
    const campaign = document.getElementById("campaign").value;
    const terrainSelect = document.getElementById("terrain");
    const campaignData = this.campaignSettings[campaign];

    if (!campaignData || !campaignData.terrains) {
      console.error("No campaign data or terrains found for:", campaign);
      terrainSelect.innerHTML = '<option value="random">Random</option>';
      return;
    }

    // Clear existing options
    terrainSelect.innerHTML = '<option value="random">Random</option>';

    // Add campaign-specific terrains
    Object.entries(campaignData.terrains).forEach(([id, terrain]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = terrain.name;
      terrainSelect.appendChild(option);
    });
  }

  updateSeasonOptions() {
    const campaign = document.getElementById("campaign").value;
    const seasonSelect = document.getElementById("season");
    const campaignData = this.campaignSettings[campaign];

    if (!campaignData || !campaignData.seasons) {
      console.error("No campaign data or seasons found for:", campaign);
      seasonSelect.innerHTML = '<option value="">No seasons available</option>';
      return;
    }

    // Clear existing options
    seasonSelect.innerHTML = "";

    // Add campaign-specific seasons
    Object.entries(campaignData.seasons).forEach(([id, season]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = season.name;
      seasonSelect.appendChild(option);
    });

    // Update campaign info after setting the first season
    if (seasonSelect.options.length > 0) {
      this.updateCampaignInfo();
    }
  }

  updateCampaignInfo() {
    const campaign = document.getElementById("campaign").value;
    const season = document.getElementById("season").value;
    const campaignData = this.campaignSettings[campaign];

    if (!campaignData) {
      console.error("No campaign data found for:", campaign);
      return;
    }

    const infoElement = document.getElementById("campaignInfo");
    const seasonData = campaignData.seasons[season];

    if (!seasonData) {
      console.error("No season data found for:", season);
      infoElement.innerHTML = `
        <h4>${campaignData.name}</h4>
        <p>${campaignData.description}</p>
        <p><strong>No season selected</strong></p>
      `;
      return;
    }

    infoElement.innerHTML = `
      <h4>${campaignData.name}</h4>
      <p>${campaignData.description}</p>
      <p><strong>Current Season:</strong> ${seasonData.name}</p>
      <p>${seasonData.description}</p>
    `;
  }

  getRandomValue(min, max) {
    return Math.random() * (max - min) + min;
  }

  getInitialConditions() {
    const campaign = document.getElementById("campaign").value;
    const terrain = document.getElementById("terrain").value;
    const season = document.getElementById("season").value;
    const temp = document.getElementById("temp").value;
    const humidity = document.getElementById("humidity").value;
    const wind = document.getElementById("wind").value;
    const precipitation = document.getElementById("precipitation").value;

    const campaignData = this.campaignSettings[campaign];
    if (!campaignData) {
      console.error("No campaign data found for:", campaign);
      return {
        temperature: 0,
        humidity: 0,
        windSpeed: 0,
        precipitation: 0,
      };
    }

    const seasonData = campaignData.seasons[season];
    const terrainData =
      terrain === "random"
        ? Object.values(campaignData.terrains)[
            Math.floor(
              Math.random() * Object.keys(campaignData.terrains).length
            )
          ]
        : campaignData.terrains[terrain];

    // Base values from terrain or input fields
    const baseValues = {
      temperature: temp ? parseFloat(temp) : terrainData.temperature,
      humidity: humidity ? parseFloat(humidity) : terrainData.humidity,
      windSpeed: wind ? parseFloat(wind) : terrainData.wind,
      precipitation: precipitation
        ? parseFloat(precipitation)
        : terrainData.precipitation || 0,
    };

    // Apply seasonal modifiers
    return {
      temperature: baseValues.temperature + seasonData.modifiers.temperature,
      humidity: Math.max(
        -10,
        Math.min(10, baseValues.humidity + seasonData.modifiers.humidity)
      ),
      windSpeed: Math.max(
        -10,
        Math.min(10, baseValues.windSpeed + seasonData.modifiers.wind)
      ),
      precipitation: Math.max(
        -10,
        Math.min(
          10,
          baseValues.precipitation + seasonData.modifiers.precipitation
        )
      ),
    };
  }

  updateWeather(initial) {
    const timeStep = parseInt(document.getElementById("timeStep").value); // Hours
    const campaign = document.getElementById("campaign").value;
    const terrain = document.getElementById("terrain").value;
    const season = document.getElementById("season").value;

    const campaignData = this.campaignSettings[campaign];
    if (!campaignData) {
      console.error("No campaign data found for:", campaign);
      return;
    }

    const seasonData = campaignData.seasons[season];
    const terrainData =
      terrain === "random"
        ? Object.values(campaignData.terrains)[
            Math.floor(
              Math.random() * Object.keys(campaignData.terrains).length
            )
          ]
        : campaignData.terrains[terrain];

    // Get time-based modifiers
    const timeOfDay = this.getTimeOfDay();
    const timeModifier = campaignData.timeModifiers[timeOfDay] || {
      temperature: 0,
      wind: 0,
      precipitation: 0,
      humidity: 0,
    };

    if (initial) {
      this.weatherData = {
        temperature: [initial.temperature],
        humidity: [initial.humidity],
        windSpeed: [initial.windSpeed],
        precipitation: [initial.precipitation],
        time: [0],
      };
    } else {
      const lastTemp = this.weatherData.temperature[
        this.weatherData.temperature.length - 1
      ];
      const lastHumidity = this.weatherData.humidity[
        this.weatherData.humidity.length - 1
      ];
      const lastWind = this.weatherData.windSpeed[
        this.weatherData.windSpeed.length - 1
      ];
      const lastPrecipitation = this.weatherData.precipitation[
        this.weatherData.precipitation.length - 1
      ];

      // Generate random factors based on terrain variability
      const randomFactors = {
        temp: ((Math.random() * 2 - 1) * terrainData.variability) / 4,
        wind: ((Math.random() * 2 - 1) * terrainData.variability) / 2,
        precip: ((Math.random() * 2 - 1) * terrainData.variability) / 2,
        humid: ((Math.random() * 2 - 1) * terrainData.variability) / 2,
      };

      // Calculate new values using the main application's logic:
      // 1. Take average of terrain base and previous state
      // 2. Add random factors
      // 3. Add time and season modifiers
      // 4. Clamp between -10 and 10

      const newTemp = Math.max(
        -10,
        Math.min(
          10,
          Math.round(
            (terrainData.temperature + lastTemp) / 2 +
              randomFactors.temp +
              timeModifier.temperature +
              seasonData.modifiers.temperature
          )
        )
      );

      const newWind = Math.max(
        -10,
        Math.min(
          10,
          Math.round(
            (terrainData.windSpeed + lastWind) / 2 +
              randomFactors.wind +
              timeModifier.wind +
              seasonData.modifiers.wind
          )
        )
      );

      const newPrecip = Math.max(
        -10,
        Math.min(
          10,
          Math.round(
            (terrainData.precipitation + lastPrecipitation) / 2 +
              randomFactors.precip +
              timeModifier.precipitation +
              seasonData.modifiers.precipitation
          )
        )
      );

      // Update precipitation description based on value
      const precipDescription = this.getPrecipitationDescription(newPrecip);

      const newHumid = Math.max(
        -10,
        Math.min(
          10,
          Math.round(
            (terrainData.humidity + lastHumidity) / 2 +
              randomFactors.humid +
              timeModifier.humidity +
              seasonData.modifiers.humidity
          )
        )
      );

      // Update humidity description based on value
      const humidDescription = this.getHumidityDescription(newHumid);

      this.weatherData.temperature.push(newTemp);
      this.weatherData.humidity.push(newHumid);
      this.weatherData.windSpeed.push(newWind);
      this.weatherData.precipitation.push(newPrecip);
      this.weatherData.time.push(this.currentTime);
    }

    this.updateChart();
    this.updateWeatherTable();
  }

  updateChart() {
    const campaign = document.getElementById("campaign").value;

    this.chart.data.labels = this.weatherData.time.map((t) => {
      const days = Math.floor(t / 24);
      const hours = Math.floor(t % 24);
      return `${days}d ${hours}h`;
    });

    // Convert temperatures to Fahrenheit
    this.chart.data.datasets[0].data = this.weatherData.temperature.map((t) =>
      this.convertTemperature(t, campaign)
    );

    this.chart.data.datasets[1].data = this.weatherData.humidity;

    // Convert wind speed to mph
    this.chart.data.datasets[2].data = this.weatherData.windSpeed.map((w) =>
      this.convertWindSpeed(w)
    );

    this.chart.data.datasets[3].data = this.weatherData.precipitation;
    this.chart.update();
  }

  updateWeatherTable() {
    const tableBody = document.querySelector("#weatherTable tbody");
    const campaign = document.getElementById("campaign").value;
    tableBody.innerHTML = "";

    for (let i = 0; i < this.weatherData.time.length; i++) {
      const row = document.createElement("tr");

      // Format time
      const days = Math.floor(this.weatherData.time[i] / 24);
      const hours = Math.floor(this.weatherData.time[i] % 24);
      const timeString = `${days}d ${hours}h`;

      // Get precipitation level based on humidity and precipitation value
      const precipitation = this.getPrecipitationLevel(
        this.weatherData.humidity[i],
        this.weatherData.precipitation[i]
      );

      // Convert temperature to Fahrenheit
      const realTemp = this.convertTemperature(
        this.weatherData.temperature[i],
        campaign
      );

      // Convert wind speed to mph
      const realWind = this.convertWindSpeed(this.weatherData.windSpeed[i]);

      row.innerHTML = `
        <td>${timeString}</td>
        <td>${realTemp.toFixed(1)}</td>
        <td>${realWind.toFixed(1)}</td>
        <td>${precipitation}</td>
        <td>${this.weatherData.humidity[i].toFixed(1)}</td>
      `;

      tableBody.appendChild(row);
    }
  }

  getPrecipitationLevel(humidity, precipitation) {
    if (precipitation < -5) return "None";
    if (precipitation < -2) return "Light";
    if (precipitation < 2) return "Moderate";
    if (precipitation < 5) return "Heavy";
    return "Torrential";
  }

  startSimulation() {
    const duration = parseInt(document.getElementById("duration").value) * 24; // Convert days to hours
    const timeStep = parseInt(document.getElementById("timeStep").value); // Hours

    this.currentTime = 0;
    const initial = this.getInitialConditions();
    this.updateWeather(initial);

    document.getElementById("startSimulation").disabled = true;
    document.getElementById("stopSimulation").disabled = false;

    this.simulationInterval = setInterval(() => {
      this.currentTime += timeStep;
      this.updateWeather();

      if (this.currentTime >= duration) {
        this.stopSimulation();
      }
    }, 1000); // Update every second
  }

  stopSimulation() {
    clearInterval(this.simulationInterval);
    document.getElementById("startSimulation").disabled = false;
    document.getElementById("stopSimulation").disabled = true;
  }

  getTimeOfDay() {
    const hour = this.currentTime % 24;
    if (hour >= 0 && hour < 6) return "Early Morning";
    if (hour >= 6 && hour < 12) return "Noon";
    if (hour >= 12 && hour < 18) return "Afternoon";
    if (hour >= 18 && hour < 22) return "Night";
    return "Late Night";
  }

  setRandomWeather() {
    // Generate random values between 0 and 10
    const randomTemp = Math.floor(Math.random() * 11);
    const randomHumidity = Math.floor(Math.random() * 11);
    const randomWind = Math.floor(Math.random() * 11);
    const randomPrecipitation = Math.floor(Math.random() * 11);

    // Update the input fields
    document.getElementById("temp").value = randomTemp;
    document.getElementById("humidity").value = randomHumidity;
    document.getElementById("wind").value = randomWind;
    document.getElementById("precipitation").value = randomPrecipitation;

    // If simulation is running, update the weather immediately
    if (this.simulationInterval) {
      const initial = this.getInitialConditions();
      this.updateWeather(initial);
    }
  }

  convertTemperature(value, campaign) {
    switch (campaign) {
      case "athas":
        // Athas: -10 to 10 maps to 40°F to 140°F
        return (value + 10) * 5 + 40;
      case "earth":
      case "greyhawk":
      default:
        // Earth/Greyhawk: -10 to 10 maps to 0°F to 100°F
        return (value + 10) * 5 + 0;
    }
  }

  convertWindSpeed(kmh) {
    // Convert km/h to mph
    return kmh * 0.621371;
  }

  getTemperatureLabel() {
    return "Temperature (°F)";
  }

  getWindSpeedLabel() {
    return "Wind Speed (mph)";
  }

  getPrecipitationDescription(precipitation) {
    if (precipitation < -5) return "None";
    if (precipitation < -2) return "Light";
    if (precipitation < 2) return "Moderate";
    if (precipitation < 5) return "Heavy";
    return "Torrential";
  }

  getHumidityDescription(humidity) {
    if (humidity < -5) return "Very Dry";
    if (humidity < 0) return "Dry";
    if (humidity < 5) return "Normal";
    if (humidity < 10) return "Humid";
    return "Very Humid";
  }
}

// Initialize the simulator when the page loads
window.addEventListener("load", () => {
  new WeatherSimulator();
});
